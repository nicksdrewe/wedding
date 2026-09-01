"use server";

// Self-service actions for a signed-in guest editing their own details on
// /account. These deliberately use the session-aware client (createClient)
// rather than the admin client — RLS from 0027_guest_self_service_and_role_
// editing.sql is what actually enforces "a guest can only touch their own
// contact row, their own +1s, and their own rsvps". Trust the database to
// reject anything out of bounds; these actions just shape the request and
// surface whatever error RLS (or a check constraint) hands back.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";

async function requireOwnContactId(): Promise<
  { contactId: string; error: null } | { contactId: null; error: string }
> {
  const profile = await getCurrentProfile();
  if (!profile) return { contactId: null, error: "You need to be signed in to do that." };
  if (!profile.contact_id) {
    return { contactId: null, error: "Your account isn't linked to a guest record yet." };
  }
  return { contactId: profile.contact_id, error: null };
}

const detailsSchema = z.object({
  fullName: z.string().trim().min(1, "Name can't be empty").max(200),
  guestNote: z.string().trim().max(1000).optional(),
});

export async function updateOwnDetails(
  formData: FormData
): Promise<{ error: string | null }> {
  const { contactId, error: authError } = await requireOwnContactId();
  if (!contactId) return { error: authError };

  const parsed = detailsSchema.safeParse({
    fullName: formData.get("fullName"),
    guestNote: formData.get("guestNote") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      full_name: parsed.data.fullName,
      guest_note: parsed.data.guestNote || null,
    })
    .eq("id", contactId);

  if (error) return { error: error.message };

  revalidatePath("/account");
  return { error: null };
}

const addPlusOneSchema = z.object({
  name: z.string().trim().min(1, "Name can't be empty").max(200),
});

export async function addOwnPlusOne(
  formData: FormData
): Promise<{ error: string | null }> {
  const { contactId, error: authError } = await requireOwnContactId();
  if (!contactId) return { error: authError };

  const parsed = addPlusOneSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // No plus_one_limit is set here — a +1's own limit defaults to 0 (they
  // can't bring a further +1 of their own), and the cap on how many a
  // guest may add is enforced server-side by fn_guest_plus_one_count via
  // the "guest adds own plus ones" RLS policy, not by anything client-sent.
  const { error } = await supabase.from("contacts").insert({
    full_name: parsed.data.name,
    parent_contact_id: contactId,
  });

  if (error) {
    // RLS rejects an insert past the limit with a generic permission-denied
    // message rather than a friendly one — translate it so the UI can show
    // guests something that makes sense instead of a Postgres error code.
    if (error.code === "42501") {
      return { error: "You've already added as many guests as your invitation allows." };
    }
    return { error: error.message };
  }

  revalidatePath("/account");
  return { error: null };
}

export async function removeOwnPlusOne(id: string): Promise<{ error: string | null }> {
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return { error: "Invalid guest." };

  const { contactId, error: authError } = await requireOwnContactId();
  if (!contactId) return { error: authError };

  const supabase = await createClient();
  // Scoped to parent_contact_id = own contact id as well as id, so this can
  // never delete anything but a +1 this guest themselves added — belt and
  // braces alongside the delete RLS policy already covering contacts.
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", parsedId.data)
    .eq("parent_contact_id", contactId);

  if (error) return { error: error.message };

  revalidatePath("/account");
  return { error: null };
}

const rsvpSchema = z.object({
  eventId: z.string().uuid(),
  attending: z.boolean(),
  dietaryRequirements: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function updateOwnRsvp(
  input: z.infer<typeof rsvpSchema>
): Promise<{ error: string | null }> {
  const { contactId, error: authError } = await requireOwnContactId();
  if (!contactId) return { error: authError };

  const parsed = rsvpSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("rsvps").upsert(
    {
      contact_id: contactId,
      event_id: parsed.data.eventId,
      attending: parsed.data.attending,
      dietary_requirements: parsed.data.dietaryRequirements || null,
      notes: parsed.data.notes || null,
      responded_at: new Date().toISOString(),
    },
    { onConflict: "contact_id,event_id" }
  );

  if (error) return { error: error.message };

  // Deliberately NOT touching contacts.rsvp_status here — that column is
  // written only by the wedding's own personal-invite-link flow
  // (api/rsvp/[token]/route.ts) and means specifically "responded to the
  // Wedding". This action handles any open event via the generic rsvps
  // table (same as api/events/[eventSlug]/rsvp/route.ts, which also never
  // touches rsvp_status) — setting it here from a non-wedding event's
  // response would silently overwrite a guest's real Wedding RSVP status.

  revalidatePath("/account");
  return { error: null };
}
