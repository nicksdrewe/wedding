"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const RSVP_STATUS = z.enum(["pending", "attending", "declined"]);

const contactSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  role: z.enum(["couple", "family", "wedding_party", "guest"]),
  plusOneEligible: z.boolean(),
});

const updateContactSchema = contactSchema.extend({
  id: z.string().uuid(),
  tags: z.string().optional(),
  rsvpStatus: RSVP_STATUS,
  engagementRsvpStatus: RSVP_STATUS,
});

function tagsToArray(tags: string | undefined) {
  return (tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// Shared by updateContact (manually correcting a response) and
// addChildContact (marking a manually-added plus one as attending) — the
// engagement party RSVP has no dedicated column on contacts the way the
// wedding one does (contacts.rsvp_status); it lives in the shared rsvps
// table keyed by event_id (see api/engagement-rsvp/route.ts), so setting
// it always means resolving the Engagement Party event id first.
async function upsertEngagementRsvp(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contactId: string,
  status: z.infer<typeof RSVP_STATUS>
) {
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("name", "Engagement Party")
    .maybeSingle();
  if (!event) return null;

  const { error } = await supabase.from("rsvps").upsert(
    {
      contact_id: contactId,
      event_id: event.id,
      attending: status === "pending" ? null : status === "attending",
      responded_at: status === "pending" ? null : new Date().toISOString(),
    },
    { onConflict: "contact_id,event_id" }
  );
  return error;
}

export async function addContact(formData: FormData) {
  const parsed = contactSchema.parse({
    fullName: formData.get("fullName"),
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    role: formData.get("role"),
    plusOneEligible: formData.get("plusOneEligible") === "on",
  });

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").insert({
    full_name: parsed.fullName,
    email: parsed.email || null,
    phone: parsed.phone || null,
    role: parsed.role,
    plus_one_eligible: parsed.plusOneEligible,
  });

  revalidatePath("/guests");
  return { error: error?.message ?? null };
}

export async function updateContact(formData: FormData) {
  const parsed = updateContactSchema.parse({
    id: formData.get("id"),
    fullName: formData.get("fullName"),
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    role: formData.get("role"),
    plusOneEligible: formData.get("plusOneEligible") === "on",
    tags: formData.get("tags") || "",
    rsvpStatus: formData.get("rsvpStatus"),
    engagementRsvpStatus: formData.get("engagementRsvpStatus"),
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      full_name: parsed.fullName,
      email: parsed.email || null,
      phone: parsed.phone || null,
      role: parsed.role,
      plus_one_eligible: parsed.plusOneEligible,
      tags: tagsToArray(parsed.tags),
      rsvp_status: parsed.rsvpStatus,
    })
    .eq("id", parsed.id);
  if (error) return { error: error.message };

  const rsvpError = await upsertEngagementRsvp(supabase, parsed.id, parsed.engagementRsvpStatus);
  if (rsvpError) return { error: rsvpError.message };

  revalidatePath("/guests");
  return { error: null };
}

const addChildSchema = z.object({
  parentContactId: z.string().uuid(),
  fullName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  attendingEngagement: z.boolean(),
});

// Manually adds a "plus one" under an existing contact — the same shape
// the engagement RSVP form's dynamically-growing "bringing others" list
// creates on its own (see api/engagement-rsvp/route.ts and
// 0011_contact_hierarchy.sql), for guests who missed that field the first
// time and need adding after the fact. Mirrors that route's two writes:
// the child contact itself, then (if marked attending) an rsvps row for
// the Engagement Party event, so this plus-one shows correctly in the
// Engagement RSVP column immediately rather than sitting on "pending"
// until someone re-submits the form.
export async function addChildContact(formData: FormData) {
  const parsed = addChildSchema.parse({
    parentContactId: formData.get("parentContactId"),
    fullName: formData.get("fullName"),
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    attendingEngagement: formData.get("attendingEngagement") === "on",
  });

  const supabase = await createClient();

  const { data: child, error: insertError } = await supabase
    .from("contacts")
    .insert({
      full_name: parsed.fullName,
      email: parsed.email || null,
      phone: parsed.phone || null,
      role: "guest",
      parent_contact_id: parsed.parentContactId,
    })
    .select("id")
    .single();
  if (insertError || !child) return { error: insertError?.message ?? "Couldn't add guest." };

  const rsvpError = await upsertEngagementRsvp(
    supabase,
    child.id,
    parsed.attendingEngagement ? "attending" : "pending"
  );
  if (rsvpError) return { error: rsvpError.message };

  revalidatePath("/guests");
  return { error: null };
}

export async function deleteContact(id: string) {
  const parsed = z.string().uuid().parse(id);
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", parsed);

  revalidatePath("/guests");
  return { error: error?.message ?? null };
}
