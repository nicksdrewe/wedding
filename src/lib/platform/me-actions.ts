"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedInUser } from "./auth";

/** Change your own reply to one event, from the "Your weddings" page. */
export async function setMyRsvp(input: { weddingId: string; eventId: string; attending: boolean }): Promise<{ ok: boolean; error?: string }> {
  const user = await getSignedInUser();
  if (!user) return { ok: false, error: "Sign in again." };
  const admin = createAdminClient(input.weddingId);
  // your contact on that wedding, and the event must be one it's asking about
  const [{ data: contact }, { data: event }] = await Promise.all([
    admin.from("contacts").select("id").eq("wedding_id", input.weddingId).eq("user_id", user.id).order("created_at").limit(1).maybeSingle(),
    admin.from("events").select("id").eq("wedding_id", input.weddingId).eq("id", input.eventId).eq("rsvp_enabled", true).maybeSingle(),
  ]);
  if (!contact || !event) return { ok: false, error: "That invitation isn't yours to answer." };
  const { error } = await admin
    .from("rsvps")
    .upsert({ contact_id: contact.id, event_id: event.id, attending: input.attending, responded_at: new Date().toISOString() }, { onConflict: "contact_id,event_id" });
  if (error) return { ok: false, error: error.message };
  await admin.from("contacts").update({ rsvp_status: input.attending ? "attending" : "declined" }).eq("id", contact.id);
  revalidatePath("/me");
  return { ok: true };
}
