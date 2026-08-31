import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

// Gate for the sign-in code request: the browser has no read access to
// `contacts` (RLS restricts it to the couple and self), so this runs the
// guest-list lookup server-side with the service-role client and returns
// only a yes/no — never contact details — before the client is allowed to
// actually call Supabase's signInWithOtp. Without this, Supabase's own
// auto-create-on-first-sign-in trigger would let anyone with any email
// address get a full guest account.

const schema = z.object({ email: z.string().trim().email().max(320) });

export async function POST(request: Request) {
  // No session to key a rate limit off (this exists precisely so an
  // unauthenticated caller can check guest-list membership before
  // signing in) — falls back to IP, which is enough to stop this from
  // being used as an unlimited scripted enumeration oracle over the
  // guest list.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { ok: withinLimit } = await checkRateLimit(`request-code:${ip}`, {
    max: 20,
    windowSeconds: 60 * 60,
  });
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Too many attempts — please try again in a little while." },
      { status: 429 }
    );
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  // Escape ILIKE metacharacters in user input so it can only ever match
  // the literal address, not an arbitrary pattern — %, _, and \ are
  // Postgres's own LIKE wildcards; * is PostgREST's own alternate ilike
  // wildcard on top of that (so URLs don't need %25-encoded %). Not a
  // live exploit (* isn't valid in a real email address) but defensive.
  const escaped = body.data.email.replace(/[%_\\*]/g, "\\$&");

  const supabase = createAdminClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .ilike("email", escaped)
    .maybeSingle();

  if (!contact) {
    return NextResponse.json(
      {
        error:
          "We don't have that email on our guest list. Double-check it, or ask Nick or Ellie to add you.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
