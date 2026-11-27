import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { checkDriveConnection, driveTarget } from "@/lib/google/drive";
import { getWeddingId } from "@/lib/wedding/current";

// Couple-only health check for the Google Drive connection: open
// /api/google/status while signed in and it says whether uploads will work
// and, if not, exactly which step fails. It does a real test write (a 4-byte
// file created in the folder and deleted immediately — exactly what an upload
// does), which is the definitive "will uploads work" answer; add ?write=0 to
// skip that and only check the login.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "couple") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const write = new URL(request.url).searchParams.get("write") !== "0";
  const result = await checkDriveConnection(await driveTarget(await getWeddingId()), { write });
  return NextResponse.json(
    { connected: result.ok, account: result.account, steps: result.steps },
    { status: result.ok ? 200 : 503 }
  );
}
