import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { checkDriveConnection } from "@/lib/google/drive";

// Couple-only health check for the Google Drive connection: open
// /api/google/status while signed in and it says whether uploads will work
// and, if not, exactly which step fails. Add ?write=1 to also do a real test
// write (a 4-byte file created in the folder and deleted immediately — what
// an upload does), which is the definitive "will uploads work" answer.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "couple") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const write = new URL(request.url).searchParams.get("write") === "1";
  const result = await checkDriveConnection({ write });
  return NextResponse.json(
    { connected: result.ok, account: result.account, steps: result.steps },
    { status: result.ok ? 200 : 503 }
  );
}
