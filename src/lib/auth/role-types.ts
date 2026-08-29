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
