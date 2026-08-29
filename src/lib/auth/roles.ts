import { createClient } from "@/lib/supabase/server";

export type RoleTier = "couple" | "family" | "wedding_party" | "guest";

export type Profile = {
  id: string;
  role: RoleTier;
  full_name: string | null;
  contact_id: string | null;
};

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

/** Single source of truth for where each tier belongs after signing in. */
export const HOME_FOR_ROLE: Record<RoleTier, string> = {
  couple: "/guests",
  family: "/categories",
  wedding_party: "/categories",
  guest: "/rsvp",
};

export function canAccess(role: RoleTier, required: RoleTier[]) {
  return required.includes(role);
}
