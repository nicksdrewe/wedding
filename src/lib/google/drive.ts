import { google, type drive_v3 } from "googleapis";
import { Readable } from "node:stream";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_WEDDING_SLUG } from "@/lib/wedding/host";
import { openToken } from "./secret";

// Server-only — the client secret and refresh token must never reach the
// browser. Never import this from a "use client" file or expose the
// returned client outside a server action / route handler.
//
// Uses OAuth 2.0 with a stored refresh token for the couple's own personal
// Google account, NOT a service account — confirmed by direct testing that
// Google service accounts have zero storage quota of their own and cannot
// create files even inside a folder explicitly shared with them, unless
// that folder lives on a paid Google Workspace account with Shared Drives.
// Files uploaded here are created under the couple's own account, against
// their own personal storage quota, which does exist.

function getRedirectUri() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${site.replace(/\/$/, "")}/api/google/oauth/callback`;
}

// Exported separately from getDriveClient() because the OAuth start/
// callback routes need a client with no refresh token yet (that's the
// whole point of the flow) — only the actual upload path requires one.
export function getOAuthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET before starting the OAuth flow."
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

function getFolderId() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("Set GOOGLE_DRIVE_FOLDER_ID.");
  return folderId;
}

function getDriveClient() {
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      "Google Drive isn't connected yet — visit /api/google/oauth/start signed in as the couple to authorize it."
    );
  }
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: "v3", auth: oauth2Client });
}

// Where a wedding's photos go. Each wedding connects its own Google account
// (Settings > Your wedding > Photos); the sign-in is stored encrypted in
// wedding_secrets (0063) with the folder the site made in that Drive. The
// first wedding can still use the original connection in the hosting
// settings until it connects its own.
export type DriveTarget = { drive: drive_v3.Drive; folderId: string; source: "wedding" | "original" };

const ORIGINAL_SLUG = process.env.LEGACY_WEDDING_SLUG || DEFAULT_WEDDING_SLUG;

export async function driveTarget(weddingId: string | null): Promise<DriveTarget | null> {
  if (!weddingId) return null;
  const admin = createAdminClient(weddingId);
  const { data } = await admin.from("wedding_secrets").select("*").eq("wedding_id", weddingId).maybeSingle();
  const row = data as { drive_refresh_token?: string | null; drive_folder_id?: string | null } | null;
  if (row?.drive_refresh_token && row.drive_folder_id) {
    const token = openToken(row.drive_refresh_token);
    if (token) {
      const client = getOAuthClient();
      client.setCredentials({ refresh_token: token });
      return { drive: google.drive({ version: "v3", auth: client }), folderId: row.drive_folder_id, source: "wedding" };
    }
  }
  const { data: w } = await admin.from("weddings").select("slug").eq("id", weddingId).maybeSingle();
  if (w?.slug === ORIGINAL_SLUG && process.env.GOOGLE_OAUTH_REFRESH_TOKEN && process.env.GOOGLE_DRIVE_FOLDER_ID) {
    return { drive: getDriveClient(), folderId: getFolderId(), source: "original" };
  }
  return null;
}

export class DriveNotConnected extends Error {
  constructor() {
    super("This wedding hasn't connected a Google Drive yet.");
  }
}

export type DriveUploadResult = {
  fileId: string;
  // Points at this app's own /api/drive-image/[fileId] proxy (see that
  // route) rather than hotlinking a Google URL directly — every option
  // that does that turned out to be unreliable under concurrent load,
  // confirmed by direct testing: loading the engagement gallery's ~13
  // photos at once got roughly 2 in 3 requests rejected outright, first
  // from the undocumented lh3.googleusercontent.com/d/<id> CDN endpoint
  // this used originally, then AGAIN from drive.google.com/thumbnail (the
  // documented alternative) under the same quick-succession load. The
  // proxy fetches through the app's own authenticated Drive API access
  // instead of a public, rate-limited hotlink, and lets Vercel/the
  // browser cache the (immutable, per-fileId) result. See
  // lib/google/image-url.ts, which transforms any already-stored raw
  // Google URL to this same shape at render time, since this change
  // alone doesn't touch photos uploaded before it.
  imageUrl: string;
  viewUrl: string;
};

export async function uploadToDrive(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  target: DriveTarget | null
): Promise<DriveUploadResult> {
  if (!target) throw new DriveNotConnected();
  const { drive, folderId } = target;

  const { data } = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id, webViewLink",
  });

  const fileId = data.id;
  if (!fileId) throw new Error("Drive didn't return a file id after upload.");

  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  return {
    fileId,
    imageUrl: `/api/drive-image/${fileId}`,
    viewUrl: data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
  };
}

// Turns a Google/config failure into a plain-English cause plus the fix.
// Only ever shown to the couple (see the upload route and
// /api/google/status) — it never includes secrets, only which setting is
// at fault.
export function explainDriveError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof DriveNotConnected) {
    return "Photos need a Google Drive. Connect yours in Settings > Your wedding > Photos, then try again.";
  }
  if (/invalid_grant/i.test(message)) {
    return "Google rejected the saved login (invalid_grant): GOOGLE_OAUTH_REFRESH_TOKEN is expired, revoked, or was pasted wrongly. Reconnect at /api/google/oauth/start, paste the new token into Vercel, and redeploy. If it keeps expiring after a week, set the Google OAuth consent screen to 'In production'.";
  }
  if (/GOOGLE_OAUTH_REFRESH_TOKEN|isn't connected yet/i.test(message)) {
    return "GOOGLE_OAUTH_REFRESH_TOKEN isn't set in this environment. Add it in Vercel (Production) and redeploy.";
  }
  if (/GOOGLE_OAUTH_CLIENT_ID|GOOGLE_OAUTH_CLIENT_SECRET/i.test(message)) {
    return "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET aren't set in this environment. Add them in Vercel and redeploy.";
  }
  if (/GOOGLE_DRIVE_FOLDER_ID/i.test(message)) {
    return "GOOGLE_DRIVE_FOLDER_ID isn't set in this environment. Add it in Vercel and redeploy.";
  }
  if (/invalid_client|unauthorized_client/i.test(message)) {
    return "Google doesn't recognise the OAuth client (invalid_client): GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET in Vercel doesn't match the Google Cloud credentials.";
  }
  if (/File not found|notFound|404/i.test(message)) {
    return "The Drive folder wasn't found: GOOGLE_DRIVE_FOLDER_ID is wrong, or the connected Google account can't open that folder.";
  }
  if (/insufficient|forbidden|403|storageQuota|quota/i.test(message)) {
    return "Google refused the upload (permission or storage): the connected account may be out of Drive space or lacks access to the folder.";
  }
  return `Google Drive error: ${message}`;
}

export type DriveCheck = {
  ok: boolean;
  // Which Google account the saved login belongs to — the first thing to
  // check when the folder "isn't found" (it must be the account that owns
  // or can open that folder).
  account: string | null;
  steps: { step: string; ok: boolean; detail?: string }[];
};

// End-to-end check of the Drive connection, step by step so a failure says
// exactly where it stopped: (1) the saved login works, (2) which account it
// is, (3) the folder is visible to this app, (4) optionally a real write —
// creates a 4-byte file in the folder and deletes it straight away, which is
// exactly what an upload does. Nothing is left behind.
export async function checkDriveConnection(target: DriveTarget | null, opts: { write?: boolean } = {}): Promise<DriveCheck> {
  const result: DriveCheck = { ok: false, account: null, steps: [] };
  if (!target) {
    result.steps.push({ step: "config", ok: false, detail: explainDriveError(new DriveNotConnected()) });
    return result;
  }
  const { drive, folderId } = target;

  try {
    const about = await drive.about.get({ fields: "user(emailAddress)" });
    result.account = about.data.user?.emailAddress ?? null;
    result.steps.push({ step: "login", ok: true });
  } catch (err) {
    result.steps.push({ step: "login", ok: false, detail: explainDriveError(err) });
    return result;
  }

  try {
    await drive.files.get({ fileId: folderId, fields: "id, name", supportsAllDrives: true });
    result.steps.push({ step: "folder visible", ok: true });
  } catch (err) {
    // Informational only: this app's Drive permission (drive.file) lets it
    // write into the folder but can still make a lookup of it fail, so a
    // failure here does NOT mean uploads are broken — the test write below
    // is what decides.
    result.steps.push({
      step: "folder lookup (informational)",
      ok: false,
      detail: `${explainDriveError(err)} (A failed lookup can still allow uploads — see the test write.)`,
    });
    // Not fatal: this app's permission (drive.file) can hide a folder from
    // a lookup while still allowing writes into it, so fall through to the
    // real write test when asked.
  }

  if (opts.write) {
    let createdId: string | null = null;
    try {
      const created = await drive.files.create({
        requestBody: { name: "connection-test-delete-me.txt", parents: [folderId] },
        media: { mimeType: "text/plain", body: Readable.from(Buffer.from("test")) },
        fields: "id",
        supportsAllDrives: true,
      });
      createdId = created.data.id ?? null;
      result.steps.push({ step: "test write", ok: true });
    } catch (err) {
      result.steps.push({ step: "test write", ok: false, detail: explainDriveError(err) });
    }
    if (createdId) {
      try {
        await drive.files.delete({ fileId: createdId, supportsAllDrives: true });
        result.steps.push({ step: "test file removed", ok: true });
      } catch (err) {
        result.steps.push({ step: "test file removed", ok: false, detail: explainDriveError(err) });
      }
    }
  }

  const writeStep = result.steps.find((x) => x.step === "test write");
  result.ok = writeStep ? writeStep.ok : result.steps.every((x) => x.ok || x.step.startsWith("folder lookup"));
  return result;
}

export async function deleteFromDrive(fileId: string, target: DriveTarget | null): Promise<void> {
  if (!target) return;
  await target.drive.files.delete({ fileId });
}

// Backs /api/drive-image/[fileId] — fetches the file's actual bytes
// through the app's own authenticated Drive API access, the same client
// uploadToDrive uses, rather than a public hotlink URL. See
// DriveUploadResult's imageUrl comment for why this exists at all.
export async function getDriveFileBuffer(
  fileId: string,
  target: DriveTarget | null
): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    if (!target) throw new DriveNotConnected();
    const { drive } = target;

    const [{ data: meta }, mediaRes] = await Promise.all([
      drive.files.get({ fileId, fields: "mimeType" }),
      drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" }),
    ]);

    return {
      buffer: Buffer.from(mediaRes.data as ArrayBuffer),
      mimeType: meta.mimeType ?? "application/octet-stream",
    };
  } catch (err) {
    // The OAuth refresh token can expire or be revoked (Google does this
    // after 7 days while the consent screen is in "Testing" — surfacing as
    // invalid_grant), which used to break EVERY photo on the site even
    // though each file is publicly readable (see uploadToDrive). Serving
    // through Google's public endpoint instead keeps photos working; this
    // runs server-side and the result is cached immutably by the route, so
    // the rate-limiting that made hotlinking unreliable from browsers
    // doesn't apply here. Uploads/deletes still need a valid token.
    console.error(`Drive API fetch failed for ${fileId}, falling back to public URL:`, err);
    const res = await fetch(`https://lh3.googleusercontent.com/d/${fileId}=w1600`);
    if (!res.ok) throw new Error(`Public Drive fetch failed: ${res.status}`);
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      mimeType: res.headers.get("content-type") ?? "image/jpeg",
    };
  }
}
