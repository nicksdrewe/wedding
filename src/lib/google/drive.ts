import { google } from "googleapis";
import { Readable } from "node:stream";

// Server-only — the service account private key must never reach the
// browser. Never import this from a "use client" file or expose the
// returned client outside a server action / route handler.

function getCredentials() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!json || !folderId) {
    throw new Error(
      "Google Drive isn't configured — set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_FOLDER_ID."
    );
  }

  let key: { client_email: string; private_key: string };
  try {
    key = JSON.parse(json);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON isn't valid JSON — check it was pasted in full.");
  }

  return { key, folderId };
}

function getDriveClient() {
  const { key } = getCredentials();
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

export type DriveUploadResult = {
  fileId: string;
  // Google's image-serving CDN — more reliable for hotlinking as an <img
  // src> than the drive.google.com/uc?export=view URL, which can trigger
  // an interstitial "can't scan for viruses" page for some file types.
  imageUrl: string;
  viewUrl: string;
};

// Uploads into the single shared folder every upload across the app uses
// (GOOGLE_DRIVE_FOLDER_ID) — the couple owns that folder, guests never need
// their own Google account or any OAuth consent screen. Makes the file
// readable by "anyone with the link" immediately after upload, since these
// are photos meant to be shown on public-ish pages (engagement gallery,
// category option boards), not private documents.
export async function uploadToDrive(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<DriveUploadResult> {
  const { folderId } = getCredentials();
  const drive = getDriveClient();

  const { data } = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
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
