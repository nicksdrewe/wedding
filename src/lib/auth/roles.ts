import { createClient } from "@/lib/supabase/server";

export type RoleTier = "couple" | "family" | "wedding_party" | "guest";

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, contact_id")
    .eq("id", user.id)
    .maybeSingle();

  return profile as { id: string; role: RoleTier; full_name: string | null; contact_id: string | null } | null;
}
