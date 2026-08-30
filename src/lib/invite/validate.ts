import { createAdminClient } from "@/lib/supabase/admin";

// Not a Server Action (no "use server" here, unlike lib/invite/actions.ts)
// — this is only ever called from /i/[token]'s own server-rendered page,
// never invoked as an RPC from the client. Uses the service-role admin
// client rather than the session-aware one: the visitor following this
// link is, by definition, not signed in yet, so there's no session to
// scope an RLS-restricted read to.
export async function isValidInviteToken(token: string) {
  if (!token) return false;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("invite_links")
    .select("id")
    .eq("token", token)
    .is("revoked_at", null)
    .maybeSingle();
  return !!data;
}
