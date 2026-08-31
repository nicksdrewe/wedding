import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { uploadToDrive } from "@/lib/google/drive";

// Generic image upload endpoint backing every "add a photo" flow in the
// app (category options, and anywhere else that adopts it later) — one
// pipeline into the couple's shared Drive folder rather than a bespoke
// uploader per feature.
//
// Requires a real session (this path isn't in the middleware's public
// list, so an anonymous request is already redirected to /login before it
// gets here) and excludes the plain 'guest' tier — uploading planning
// photos isn't something a guest needs to do.

const MAX_BYTES = 8 * 1024 * 1024; // 8MB — generous for a phone photo, small enough not to choke on venue wifi
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "guest") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WEBP, or GIF images are supported." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large (8MB max)." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  try {
    const result = await uploadToDrive(buffer, safeName, file.type);
    return NextResponse.json({ url: result.imageUrl, fileId: result.fileId });
  } catch (err) {
    // Logged server-side for diagnosis, but never returned verbatim — a
    // Google API error can echo back request details (the refresh token
    // isn't in it, but folder IDs and internal error shapes are) that a
    // signed-in-but-untrusted caller has no reason to see.
    console.error("Drive upload failed:", err);
    return NextResponse.json({ error: "Upload failed — please try again." }, { status: 500 });
  }
}
