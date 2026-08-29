import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// Public, unauthenticated self-service RSVP for the engagement party — no
// personal invite link required, unlike the main wedding's token-gated
// /api/rsvp/[token]. Anyone can add themselves, their email, and a plus one
// straight into the CRM under the "Engagement Party" event.

const schema = z.object({
  fullName: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  attending: z.boolean(),
  plusOneAttending: z.boolean().optional(),
  plusOneName: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const { fullName, email, attending, plusOneAttending, plusOneName } = body.data;
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
      plus_one_attending: attending ? plusOneAttending ?? false : false,
      plus_one_name: attending ? plusOneName ?? null : null,
      responded_at: new Date().toISOString(),
    },
    { onConflict: "contact_id,event_id" }
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
