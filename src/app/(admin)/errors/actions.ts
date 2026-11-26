"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";

export async function clearErrors(): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "couple") return { error: "Only the couple can do that." };

  const supabase = await createClient();
  // The policy only lets the couple delete; filtering on a column that is
  // always set is how Supabase expresses "every row".
  const { error } = await supabase.from("error_log").delete().not("id", "is", null);
  if (error) return { error: "Couldn't clear the list." };

  revalidatePath("/errors");
  return { error: null };
}
