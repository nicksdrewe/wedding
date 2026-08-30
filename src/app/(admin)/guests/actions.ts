"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
});

function tagsToArray(tags: string | undefined) {
  return (tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
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
    })
    .eq("id", parsed.id);

  revalidatePath("/guests");
  return { error: error?.message ?? null };
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

  if (parsed.attendingEngagement) {
    const { data: event } = await supabase
      .from("events")
      .select("id")
      .eq("name", "Engagement Party")
      .maybeSingle();

    if (event) {
      const { error: rsvpError } = await supabase.from("rsvps").upsert(
        { contact_id: child.id, event_id: event.id, attending: true, responded_at: new Date().toISOString() },
        { onConflict: "contact_id,event_id" }
      );
      if (rsvpError) return { error: rsvpError.message };
    }
  }

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
