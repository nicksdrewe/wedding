import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getOAuthClient } from "@/lib/google/drive";

// Couple-only, one-time authorization: grants this app permission to
// create files in the couple's own Google Drive. drive.file scope only —
// the app can see/manage files it creates itself, nothing else already in
// their Drive.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "couple") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    // Forces Google to issue a refresh token even if this app was already
    // authorized before — otherwise a repeat authorization silently omits
    // it, since Google only guarantees issuing one on first consent.
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file"],
  });

  return NextResponse.redirect(url);
}
