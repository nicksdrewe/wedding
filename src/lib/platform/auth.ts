import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Who is signed in, whatever wedding (if any) they belong to: the "your
// weddings" page and the owner's console work across weddings, so they can't
// rely on the per-wedding profile.
export const getSignedInUser = cache(async (): Promise<{ id: string; email: string | null } | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email.toLowerCase() : null };
});

/** The site owner(s): PLATFORM_ADMIN_EMAILS in the hosting settings, comma separated. */
export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function requirePlatformAdmin() {
  const user = await getSignedInUser();
  return user && isPlatformAdminEmail(user.email) ? user : null;
}
