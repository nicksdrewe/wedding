// Client-safe half of the role model — pure types and pure functions only,
// no "next/headers"/Supabase server client anywhere in this file's import
// graph. Split out of roles.ts because that file also holds getAuthState()/
// getCurrentProfile() (server-only, via @/lib/supabase/server); a "use
// client" component importing anything at all from a module drags that
// module's *entire* import graph into the client bundle, and AppShell.tsx
// needs Profile/RoleTier/canAccess without pulling next/headers along with
// them. roles.ts re-exports everything here for existing server-side
// callers, so this split changes no behavior.

export type RoleTier = "couple" | "family" | "wedding_party" | "guest";

export type Profile = {
  id: string;
  role: RoleTier;
  full_name: string | null;
  contact_id: string | null;
};

/**
 * Where each tier belongs after signing in, by role alone. wedding_party and
 * guest land on /account (their own details) — the one page every one of
 * them is guaranteed to have. wedding_party previously landed on
 * /categories, which a plain wedding-party member has no access to, so their
 * very first sign-in ended on an error page. Use homeFor() when tags are
 * known; this is the fallback.
 */
export const HOME_FOR_ROLE: Record<RoleTier, string> = {
  couple: "/guests",
  family: "/categories",
  wedding_party: "/account",
  guest: "/account",
};

/**
 * Role + contact tags (already normalised, see lib/tags.ts) -> landing page.
 * Best man / maid of honour are role wedding_party with an elevated tag and
 * start on the project hub instead of the plain wedding-party default.
 */
export function homeFor(role: RoleTier, tags: readonly string[]): string {
  if (role === "wedding_party" && (tags.includes("best_man") || tags.includes("maid_of_honour"))) {
    return "/project";
  }
  return HOME_FOR_ROLE[role];
}

export function canAccess(role: RoleTier, required: RoleTier[]) {
  return required.includes(role);
}
