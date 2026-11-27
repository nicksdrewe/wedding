import { SUPABASE_URL } from "@/lib/supabase/url";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { WEDDING_HEADER } from "@/lib/wedding/host";

// Service-role client — server-only, bypasses RLS. Never import this from client components.
//
// Row security doesn't apply to it, so the wedding it is told about matters for
// two things only: new rows are stamped with it, and the per-wedding profiles
// view answers for it. Reads of wedding-owned tables must still filter by
// wedding_id themselves.
export function createAdminClient(weddingId?: string | null) {
  return createSupabaseClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: { headers: weddingId ? { [WEDDING_HEADER]: weddingId } : {} },
    }
  );
}
