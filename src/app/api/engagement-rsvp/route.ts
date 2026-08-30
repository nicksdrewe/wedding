import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// Public, unauthenticated self-service RSVP for the engagement party — no
// personal invite link required, unlike the main wedding's token-gated
// /api/rsvp/[token]. Anyone can add themselves, their email, and any
// number of others they're bringing (parent/child, a plus one, a whole
// family) straight into the CRM under the "Engagement Party" event.
//
// Each "other" becomes its own contacts row, nested under the submitter
// via parent_contact_id (see 0011_contact_hierarchy.sql), with its own
// rsvps row — so a plain count of contacts/rsvps naturally includes them,
// no separate tally needed.

const schema = z.object({
  fullName: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  attending: z.boolean(),
  // Names of additional attendees the submitter is bringing. No email
  // required for these — they're not the ones logging in with an RSVP
  // link, just guests being logged. Capped generously as a defensive
  // limit, not a UX-visible one (the form itself has no cap).
  others: z.array(z.string().trim().min(1).max(200)).max(25).optional(),
});

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const { fullName, email, attending, others } = body.data;
  const normalizedEmail = email.toLowerCase();
  const escapedEmail = normalizedEmail.replace(/[%_\\]/g, "\\$&");

  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("name", "Engagement Party")
    .maybeSingle();

  if (!event) {
    return NextResponse.json(
      { error: "The engagement party isn't set up yet — try again shortly." },
      { status: 500 }
    );
  }

  // Reuse an existing contact by email if they're already on the list (e.g.
  // a real wedding guest also RSVPing here) rather than creating a
  // duplicate row.
  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id")
    .ilike("email", escapedEmail)
    .maybeSingle();

  let contactId = existingContact?.id as string | undefined;

  if (!contactId) {
    const { data: newContact, error: insertError } = await supabase
      .from("contacts")
      .insert({ full_name: fullName, email: normalizedEmail, plus_one_eligible: true })
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
  // parent. If they're now declining, this also correctly leaves no
  // children behind: there's no one coming to log.
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
