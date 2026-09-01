import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/auth/role-types";

// Re-exported for existing server-side callers of this module — see
// role-types.ts for why these live in their own client-safe file.
export type { RoleTier, Profile } from "@/lib/auth/role-types";
export { HOME_FOR_ROLE, canAccess } from "@/lib/auth/role-types";

// Deliberately three-way. Collapsing "no session" and "session but no profile"
// into a single null is what caused the sign-in loop: an authenticated user
// with no profile row got redirected to /login, signed in fine, and bounced
// again forever. Callers must be able to tell those apart.
export type AuthState =
  | { status: "anonymous" }
  | { status: "no-profile"; email: string | null }
  | { status: "ok"; profile: Profile };

export async function getAuthState(): Promise<AuthState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "anonymous" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, contact_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return { status: "no-profile", email: user.email ?? null };

  return { status: "ok", profile: profile as Profile };
}

/** Convenience for pages that only care about a fully-resolved profile. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const state = await getAuthState();
  return state.status === "ok" ? state.profile : null;
}

// The signed-in user's own contact tags (best_man, bridesmaid, etc.) —
// used purely for nav-link visibility (AppShell), which is a client
// component and can't call the permissions resolver itself. This is a
// convenience lookup, not a security boundary: the actual page/data/edit
// access for anything tag-gated is still enforced by
// getEffectivePermission (page-level) and RLS (data-level) regardless of
// what nav links happen to render.
export async function getCurrentContactTags(profile: Profile | null): Promise<string[]> {
  if (!profile?.contact_id) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("contacts").select("tags").eq("id", profile.contact_id).maybeSingle();
  return data?.tags ?? [];
}
