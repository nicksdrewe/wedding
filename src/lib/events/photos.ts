"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Couple-only writes, enforced by RLS (see 0008_engagement_photos.sql,
// still governing this table under its original name — see 0017's
// comment on why it wasn't renamed) — session-aware client, not the
// admin one, so a non-couple caller's insert/delete is rejected at the
// database level regardless of what the UI shows them.
//
// Generalized from lib/engagement/actions.ts (which only ever wrote
// against the one hardcoded Engagement Party event) to accept an eventId,
// now that any event created through the events system can have its own
// photo board. Every function also takes the event's slug purely to
// revalidate the exact page it's called from — Server Actions only
// auto-refresh the currently-displayed route when the revalidated path
// matches it precisely.

const addSchema = z.object({
  eventId: z.string().uuid(),
  imageUrl: z.string().min(1),
  caption: z.string().max(200).optional(),
});

export async function addEventPhoto(eventId: string, slug: string, imageUrl: string, caption?: string) {
  const parsed = addSchema.parse({ eventId, imageUrl, caption });
  const supabase = await createClient();

  const { data: existing, error: countError } = await supabase
    .from("engagement_photos")
    .select("sort_order")
    .eq("event_id", parsed.eventId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (countError) return { error: countError.message };

  const { error } = await supabase.from("engagement_photos").insert({
    event_id: parsed.eventId,
    image_url: parsed.imageUrl,
    caption: parsed.caption ?? null,
    sort_order: (existing?.sort_order ?? -1) + 1,
  });
  if (error) return { error: error.message };

  revalidatePath(`/events/${slug}`);
  return { error: null };
}

export async function updateEventPhoto(photoId: string, slug: string, imageUrl: string) {
  const parsed = z.object({ photoId: z.string().uuid(), imageUrl: z.string().min(1) }).parse({ photoId, imageUrl });
  const supabase = await createClient();

  const { error } = await supabase
    .from("engagement_photos")
    .update({ image_url: parsed.imageUrl })
    .eq("id", parsed.photoId);
  if (error) return { error: error.message };

  revalidatePath(`/events/${slug}`);
  return { error: null };
}

export async function updateEventPhotoCaption(photoId: string, slug: string, caption: string) {
  const parsed = z
    .object({ photoId: z.string().uuid(), caption: z.string().max(200) })
    .parse({ photoId, caption });
  const supabase = await createClient();

  const { error } = await supabase
    .from("engagement_photos")
    .update({ caption: parsed.caption || null })
    .eq("id", parsed.photoId);
  if (error) return { error: error.message };

  revalidatePath(`/events/${slug}`);
  return { error: null };
}

export async function removeEventPhoto(photoId: string, slug: string) {
  const parsed = z.string().uuid().parse(photoId);
  const supabase = await createClient();

  const { error } = await supabase.from("engagement_photos").delete().eq("id", parsed);
  if (error) return { error: error.message };

  revalidatePath(`/events/${slug}`);
  return { error: null };
}
