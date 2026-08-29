import { google } from "googleapis";
import { Readable } from "node:stream";

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

export type DriveUploadResult = {
  fileId: string;
  // Google's image-serving CDN — more reliable for hotlinking as an <img
  // src> than the drive.google.com/uc?export=view URL, which can trigger
  // an interstitial "can't scan for viruses" page for some file types.
  imageUrl: string;
  viewUrl: string;
};

export async function uploadToDrive(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<DriveUploadResult> {
  const folderId = getFolderId();
  const drive = getDriveClient();

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
    imageUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
    viewUrl: data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
  };
}

export async function deleteFromDrive(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.files.delete({ fileId });
}
