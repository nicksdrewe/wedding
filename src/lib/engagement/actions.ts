"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Couple-only writes, enforced by RLS (see 0008_engagement_photos.sql) —
// these use the regular session-aware client, not the admin one, so a
// non-couple caller's insert/delete is rejected at the database level
// regardless of what the UI shows them.

const addSchema = z.object({
  imageUrl: z.string().min(1),
  caption: z.string().max(200).optional(),
});

export async function addEngagementPhoto(imageUrl: string, caption?: string) {
  const parsed = addSchema.parse({ imageUrl, caption });
  const supabase = await createClient();

  const { data: existing, error: countError } = await supabase
    .from("engagement_photos")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (countError) return { error: countError.message };

  const { error } = await supabase.from("engagement_photos").insert({
    image_url: parsed.imageUrl,
    caption: parsed.caption ?? null,
    sort_order: (existing?.sort_order ?? -1) + 1,
  });
  if (error) return { error: error.message };

  revalidatePath("/engagement");
  return { error: null };
}

export async function removeEngagementPhoto(photoId: string) {
  const parsed = z.string().uuid().parse(photoId);
  const supabase = await createClient();

  const { error } = await supabase.from("engagement_photos").delete().eq("id", parsed);
  if (error) return { error: error.message };

  revalidatePath("/engagement");
  return { error: null };
}
