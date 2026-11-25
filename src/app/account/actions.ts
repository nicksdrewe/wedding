"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWeddingId } from "@/lib/wedding/current";
import { getCurrentContactTags, getCurrentProfile } from "@/lib/auth/roles";

const passwordSchema = z
  .object({
    password: z.string().min(8, "Must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

export async function setPassword(
  _prevState: { error: string | null; success: boolean },
  formData: FormData
): Promise<{ error: string | null; success: boolean }> {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password, data: { password_set: true } });
  if (error) return { error: error.message, success: false };

  return { error: null, success: true };
}

const PHOTO_TAGS = ["bridesmaid", "groomsman", "best_man", "maid_of_honour"];

// Your own photo, for the couple and the wedding party: it appears on the
// groomsmen / bridesmaids charts and on the guest list. Only ever your own
// contact (taken from your session, never from the request).
export async function setMyPhoto(photoUrl: string | null) {
  const profile = await getCurrentProfile();
  if (!profile?.contact_id) return { error: "Your account isn't linked to a guest-list entry yet." };
  const tags = await getCurrentContactTags(profile);
  if (profile.role !== "couple" && !tags.some((t) => PHOTO_TAGS.includes(t))) {
    return { error: "Photos are for the couple and the wedding party." };
  }
  const parsed = z.string().min(1).max(2000).nullable().safeParse(photoUrl);
  if (!parsed.success) return { error: "That photo couldn't be saved." };

  const { error } = await createAdminClient(await getWeddingId()).from("contacts").update({ photo_url: parsed.data }).eq("id", profile.contact_id);
  if (error) {
    return { error: error.message.includes("photo_url") ? "Photos need one more database step (migration 0045) first." : error.message };
  }
  revalidatePath("/account");
  revalidatePath("/guests");
  revalidatePath("/project/groomsmen");
  revalidatePath("/project/bridesmaids");
  return { error: null };
}
