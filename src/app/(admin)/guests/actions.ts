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
  // How many extra attendees this contact can bring when an event
  // restricts "bringing others" to eligible guests only (see
  // 0022_plus_one_limits.sql) — 0 means none. Coerced from the number
  // input's string value; NaN (an empty/invalid field) falls back to 0
  // rather than failing validation outright, matching that field's
  // browser-level min=0 default.
  plusOneLimit: z.coerce.number().int().min(0).catch(0),
});

const updateContactSchema = contactSchema.extend({
  id: z.string().uuid(),
  tags: z.string().optional(),
  rsvpStatus: RSVP_STATUS,
  // One JSON blob rather than a fixed field per event — which events even
  // exist is couple-managed now (see 0017_events_system.sql), not a fixed
  // "engagement" one this action used to know about by name.
  eventRsvpStatuses: z.string(),
});

function tagsToArray(tags: string | undefined) {
  return (tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// A field failing validation (e.g. a malformed email that slipped past the
// browser's own type="email" check) used to throw straight out of
// schema.parse() with nothing catching it — server actions surface an
// uncaught throw as Next.js's generic client-side error, not the calm
// inline message these forms are built to show. Every action below uses
// safeParse and this helper instead, so a bad field always comes back as
// { error } like every other failure mode already does.
function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message || "That didn't look right — check the fields and try again.";
}

// Shared by updateContact (manually correcting a response) and
// addChildContact (marking a manually-added plus one as attending) — any
// event's RSVP has no dedicated column on contacts the way the wedding
// one does (contacts.rsvp_status); it lives in the shared rsvps table
// keyed by event_id (see api/events/[eventSlug]/rsvp/route.ts).
async function upsertEventRsvp(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contactId: string,
  eventId: string,
  status: z.infer<typeof RSVP_STATUS>
) {
  const { error } = await supabase.from("rsvps").upsert(
    {
      contact_id: contactId,
      event_id: eventId,
      attending: status === "pending" ? null : status === "attending",
      responded_at: status === "pending" ? null : new Date().toISOString(),
    },
    { onConflict: "contact_id,event_id" }
  );
  return error;
}

export async function addContact(formData: FormData) {
  const result = contactSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    role: formData.get("role"),
    plusOneLimit: formData.get("plusOneLimit") || "0",
  });
  if (!result.success) return { error: firstIssueMessage(result.error) };
  const parsed = result.data;

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").insert({
    full_name: parsed.fullName,
    email: parsed.email || null,
    phone: parsed.phone || null,
    role: parsed.role,
    plus_one_limit: parsed.plusOneLimit,
  });

  revalidatePath("/guests");
  return { error: error?.message ?? null };
}

export async function updateContact(formData: FormData) {
  const result = updateContactSchema.safeParse({
    id: formData.get("id"),
    fullName: formData.get("fullName"),
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    role: formData.get("role"),
    plusOneLimit: formData.get("plusOneLimit") || "0",
    tags: formData.get("tags") || "",
    rsvpStatus: formData.get("rsvpStatus"),
    eventRsvpStatuses: formData.get("eventRsvpStatuses") ?? "{}",
  });
  if (!result.success) return { error: firstIssueMessage(result.error) };
  const parsed = result.data;

  let eventStatuses: Record<string, string>;
  try {
    eventStatuses = JSON.parse(parsed.eventRsvpStatuses);
  } catch {
    return { error: "Couldn't read the event RSVP selections — try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      full_name: parsed.fullName,
      email: parsed.email || null,
      phone: parsed.phone || null,
      role: parsed.role,
      plus_one_limit: parsed.plusOneLimit,
      tags: tagsToArray(parsed.tags),
      rsvp_status: parsed.rsvpStatus,
    })
    .eq("id", parsed.id);
  if (error) return { error: error.message };

  for (const [eventId, status] of Object.entries(eventStatuses)) {
    const statusParsed = RSVP_STATUS.safeParse(status);
    if (!statusParsed.success) continue;
    const rsvpError = await upsertEventRsvp(supabase, parsed.id, eventId, statusParsed.data);
    if (rsvpError) return { error: rsvpError.message };
  }

  revalidatePath("/guests");
  return { error: null };
}

const addChildSchema = z.object({
  parentContactId: z.string().uuid(),
  fullName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
});

// Manually adds a "plus one" under an existing contact — the same shape
// an event's own self-service group RSVP form's dynamically-growing
// "bringing others" list creates on its own (see
// api/events/[eventSlug]/rsvp/route.ts and 0011_contact_hierarchy.sql),
// for guests who missed that field the first time and need adding after
// the fact. Mirrors that route's two writes: the child contact itself,
// then (for each event checked "attending") an rsvps row, so this
// plus-one shows correctly in that event's guest-list column immediately
// rather than sitting on "pending" until someone re-submits the form.
export async function addChildContact(formData: FormData) {
  const result = addChildSchema.safeParse({
    parentContactId: formData.get("parentContactId"),
    fullName: formData.get("fullName"),
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
  });
  if (!result.success) return { error: firstIssueMessage(result.error) };
  const parsed = result.data;

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

  // Dynamic field names (attending_<eventId>) rather than a zod-validated
  // fixed shape — the set of events on the form is couple-managed and
  // unknown to this action ahead of time.
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("attending_") || value !== "on") continue;
    const eventId = z.string().uuid().safeParse(key.slice("attending_".length));
    if (!eventId.success) continue;
    const rsvpError = await upsertEventRsvp(supabase, child.id, eventId.data, "attending");
    if (rsvpError) return { error: rsvpError.message };
  }

  revalidatePath("/guests");
  return { error: null };
}

export async function deleteContact(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid contact." };
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", parsed.data);

  revalidatePath("/guests");
  return { error: error?.message ?? null };
}
