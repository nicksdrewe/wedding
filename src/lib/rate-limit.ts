import { createAdminClient } from "@/lib/supabase/admin";

// Minimal fixed-window rate limiter for public, unauthenticated endpoints
// (api/engagement-rsvp, api/auth/request-code) — these have no session to
// gate them, so without this a scripted client can hit either one at
// unlimited volume: mass-creating contacts on the former, or using the
// latter as a guest-list membership oracle. Backed by rate_limit_hits (see
// 0014_security_hardening.sql), using the service-role client since an
// anonymous caller has no session for RLS to key off anyway.
//
// Deliberately simple — a fixed window, not sliding, with no distributed
// coordination beyond Postgres's own row locking. This only needs to stop
// trivial scripted abuse of a low-stakes personal site, not survive a
// determined, distributed attacker.
export async function checkRateLimit(
  bucketKey: string,
  { max, windowSeconds }: { max: number; windowSeconds: number }
): Promise<{ ok: boolean }> {
  const supabase = createAdminClient();
  const now = Date.now();
  const windowStartCutoff = new Date(now - windowSeconds * 1000).toISOString();

  const { data: existing } = await supabase
    .from("rate_limit_hits")
    .select("id, window_start, count")
    .eq("bucket_key", bucketKey)
    .maybeSingle();

  if (!existing || existing.window_start < windowStartCutoff) {
    // No row yet, or its window has expired — start a fresh one. The
    // unique index on bucket_key makes this upsert race-safe: a
    // concurrent request hitting the same key gets a conflict here and
    // falls through to the increment branch below on retry, rather than
    // two rows silently both existing for one key.
    await supabase
      .from("rate_limit_hits")
      .upsert(
        { bucket_key: bucketKey, window_start: new Date(now).toISOString(), count: 1 },
        { onConflict: "bucket_key" }
      );
    return { ok: true };
  }

  if (existing.count >= max) {
    return { ok: false };
  }

  await supabase
    .from("rate_limit_hits")
    .update({ count: existing.count + 1 })
    .eq("id", existing.id);
  return { ok: true };
}
