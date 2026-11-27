import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getOAuthClient } from "@/lib/google/drive";
import { signState } from "@/lib/google/secret";
import { getWeddingId } from "@/lib/wedding/current";

// Couple only: connect this wedding's own Google Drive. Google sends people
// back to one fixed address (the callback), so a signed note says which
// wedding is connecting and where to return to. drive.file scope: the site
// can only see and manage files it creates itself, nothing else in the Drive.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "couple") {
    return NextResponse.json({ error: "Only the couple can connect a Google Drive." }, { status: 403 });
  }
  const weddingId = await getWeddingId();
  if (!weddingId) return NextResponse.json({ error: "Couldn't tell which wedding this is." }, { status: 400 });

  const here = new URL(request.url);
  const back = `${here.origin}/wedding`;
  const state = signState({ w: weddingId, back, exp: Date.now() + 15 * 60 * 1000 });

  const url = getOAuthClient().generateAuthUrl({
    access_type: "offline",
    // Google only reliably returns a long-lived sign-in on first consent;
    // asking every time makes reconnecting work too.
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file"],
    state,
  });
  return NextResponse.redirect(url);
}
