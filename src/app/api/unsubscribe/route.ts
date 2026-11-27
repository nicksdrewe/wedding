import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkUnsubscribe } from "@/lib/platform/newsletter";

// Mail apps' one-click "Unsubscribe" button (RFC 8058) posts here. A plain
// visit is sent to the page with a button instead, so link checkers that open
// every link in an email can't unsubscribe anyone by accident.
export async function POST(request: Request) {
  const u = new URL(request.url);
  const e = (u.searchParams.get("e") ?? "").toLowerCase();
  const s = u.searchParams.get("s") ?? "";
  if (!e || !checkUnsubscribe(e, s)) return NextResponse.json({ error: "bad link" }, { status: 400 });
  await createAdminClient().from("platform_unsubscribes").upsert({ email: e });
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const u = new URL(request.url);
  u.pathname = "/unsubscribe";
  return NextResponse.redirect(u, 303);
}
