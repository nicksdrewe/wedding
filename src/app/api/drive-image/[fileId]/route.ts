import { NextResponse } from "next/server";
import { getDriveFileBuffer } from "@/lib/google/drive";

// Public, unauthenticated — deliberately so, matching the security
// posture of what this replaces. Every uploaded file already gets
// `permissions.create({ role: "reader", type: "anyone" })` at upload time
// (see uploadToDrive), i.e. it was already a fully public, unauthenticated
// hotlink; this route only changes HOW that public image is served (via
// the app's own authenticated Drive API access instead of a public,
// rate-limited hotlink URL), not who can see it. Needed in the auth
// middleware's public-route allowlist for the same reason /engagement
// itself is — an anonymous engagement-party visitor has to be able to
// load these images.
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;

  try {
    const { buffer, mimeType } = await getDriveFileBuffer(fileId);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        // A given fileId's content never changes after upload — replacing
        // a photo uploads a new file (a new fileId) and deletes the old
        // one (see ImageUpload's onUploaded flow) rather than overwriting
        // in place — so this is safe to cache as long as the browser and
        // Vercel's edge are willing to keep it, and later visitors never
        // have to hit Drive's API again for the same photo at all.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error(`Drive image proxy failed for ${fileId}:`, err);
    return NextResponse.json({ error: "Image unavailable" }, { status: 502 });
  }
}
