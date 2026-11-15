import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { checkDriveConnection } from "@/lib/google/drive";

// Couple-only health check for the Google Drive connection: open
// /api/google/status while signed in and it says whether uploads will work
// and, if not, exactly which setting is wrong. Creates nothing in Drive.
export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "couple") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const result = await checkDriveConnection();
  return NextResponse.json(
    result.ok ? { connected: true } : { connected: false, problem: result.reason },
    { status: result.ok ? 200 : 503 }
  );
}
