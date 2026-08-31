import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

// Public, unauthenticated self-service RSVP for any event created through
// the events system (see 0017_events_system.sql) — generalized from what
// was originally a one-off /api/engagement-rsvp built just for the
// engagement party. The main wedding's personal invite-link RSVP
// (/api/rsvp/[token]) is a deliberately separate, untouched flow — this
// is for events the couple explicitly opts into open/guest-list RSVP for.
//
// Each "other" becomes its own contacts row, nested under the submitter
// via parent_contact_id (see 0011_contact_hierarchy.sql), with its own
// rsvps row — so a plain count of contacts/rsvps naturally includes them,
// no separate tally needed.

const schema = z.object({
  fullName: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  attending: z.boolean(),
  others: z.array(z.string().trim().min(1).max(200)).max(25).optional(),
});

// PostgREST's ilike operator treats `*` as an alternate wildcard (so URLs
// don't need %25-encoded `%`), in addition to Postgres's own `%`/`_`/`\`
// LIKE metacharacters — escaping only the latter three isn't enough. `*`
// is not valid in a real email address, so this is defensive rather than
// a live exploit path.
function escapeIlike(value: string) {
  return value.replace(/[%_\\*]/g, "\\$&");
}

export async function POST(request: Request, { params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { ok: withinLimit } = await checkRateLimit(`event-rsvp:${eventSlug}:${ip}`, {
    max: 20,
    windowSeconds: 60 * 60,
  });
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Too many attempts — please try again in a little while." },
      { status: 429 }
    );
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const { fullName, email, attending, others } = body.data;
  const normalizedEmail = email.toLowerCase();
  const escapedEmail = escapeIlike(normalizedEmail);

  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, rsvp_enabled, rsvp_open")
    .eq("slug", eventSlug)
    .maybeSingle();

  if (!event || !event.rsvp_enabled) {
    return NextResponse.json({ error: "RSVPs aren't open for this event." }, { status: 404 });
  }

  // Reuse an existing contact by email if they're already on the list —
  // BUT only if that contact hasn't already answered THIS event's RSVP.
  // This endpoint is fully public and unauthenticated: anyone who knows
  // (or guesses) a guest's email could otherwise submit on their behalf
  // and silently flip their attending status, or — worse — trigger the
  // group-replace step further down and permanently delete every
  // plus-one that guest had already added. Once a contact has a real
  // response recorded for this event, any further submission under that
  // same email creates a new, clearly flagged row instead of touching
  // the original — nothing here ever overwrites or deletes an
  // already-answered contact.
  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id")
    .ilike("email", escapedEmail)
    .maybeSingle();

  let contactId: string | undefined;
  let flaggedDuplicate = false;

  if (existingContact) {
    const { data: existingRsvp } = await supabase
      .from("rsvps")
      .select("responded_at")
      .eq("contact_id", existingContact.id)
      .eq("event_id", event.id)
      .maybeSingle();

    if (existingRsvp?.responded_at) {
      flaggedDuplicate = true;
    } else {
      contactId = existingContact.id;
    }
  }

  if (!contactId) {
    // Guest-list-only events don't get to auto-create a contact for an
    // email that isn't already on file — same gate the sign-in code
    // request uses, just applied here instead.
    if (!event.rsvp_open) {
      return NextResponse.json(
        { error: "We don't have that email on our guest list — check with Nick or Ellie." },
        { status: 404 }
      );
    }

    const { data: newContact, error: insertError } = await supabase
      .from("contacts")
      .insert({
        full_name: fullName,
        email: normalizedEmail,
        plus_one_eligible: true,
        tags: flaggedDuplicate ? ["needs review — duplicate email"] : [],
      })
      .select("id")
      .single();
    if (insertError || !newContact) {
      return NextResponse.json({ error: "Couldn't save your RSVP — try again." }, { status: 500 });
    }
    contactId = newContact.id;
  }

  const { error: upsertError } = await supabase.from("rsvps").upsert(
    {
      contact_id: contactId,
      event_id: event.id,
      attending,
      responded_at: new Date().toISOString(),
    },
    { onConflict: "contact_id,event_id" }
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // Replace any group members recorded by a previous submission from this
  // same contact — resubmitting (e.g. to fix a typo'd name, or to change
  // who's coming) shouldn't accumulate duplicate contacts under the same
  // parent. Safe against the spoofing case above: contactId here is
  // either a fresh row (no children exist yet) or a contact that had
  // never actually responded — an already-answered contact's children are
  // never reachable through this delete, because contactId is never set
  // to their id in that case.
  const { error: deleteChildrenError } = await supabase
    .from("contacts")
    .delete()
    .eq("parent_contact_id", contactId);

  if (deleteChildrenError) {
    return NextResponse.json({ error: deleteChildrenError.message }, { status: 500 });
  }

  const otherNames = attending ? others ?? [] : [];

  if (otherNames.length > 0) {
    const { data: childContacts, error: childInsertError } = await supabase
      .from("contacts")
      .insert(
        otherNames.map((name) => ({
          full_name: name,
          parent_contact_id: contactId,
          role: "guest",
        }))
      )
      .select("id");

    if (childInsertError || !childContacts) {
      return NextResponse.json({ error: "Couldn't save your group — try again." }, { status: 500 });
    }

    const { error: childRsvpError } = await supabase.from("rsvps").upsert(
      childContacts.map((child) => ({
        contact_id: child.id,
        event_id: event.id,
        attending: true,
        responded_at: new Date().toISOString(),
      })),
      { onConflict: "contact_id,event_id" }
    );

    if (childRsvpError) {
      return NextResponse.json({ error: childRsvpError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
