import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// Public, unauthenticated RSVP endpoint — access is gated by the unguessable
// per-guest rsvp_token in the URL, not by login. Uses the service-role client
// because RLS on `contacts`/`rsvps` requires a session guests don't have.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: contact, error } = await supabase
    .from("contacts")
    .select("id, full_name, plus_one_eligible, rsvp_status")
    .eq("rsvp_token", token)
    .maybeSingle();

  if (error || !contact) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  // rsvp_enabled off (the default for a newly created event — see
  // 0017_events_system.sql) means the couple hasn't actually turned RSVPs
  // on for it yet, same flag the events system's own /events/[slug] page
  // checks. Without this filter, a guest's personal link would show an
  // RSVP card for an event with no real date/venue info the moment its
  // row exists at all, before the couple's ready for anyone to respond.
  const { data: events } = await supabase
    .from("events")
    .select("id, name, starts_at, location")
    .eq("rsvp_enabled", true)
    .order("starts_at", { ascending: true });

  const { data: rsvps } = await supabase
    .from("rsvps")
    .select("event_id, attending, plus_one_attending, plus_one_name, dietary_requirements, notes")
    .eq("contact_id", contact.id);

  return NextResponse.json({ contact, events: events ?? [], rsvps: rsvps ?? [] });
}

const rsvpSchema = z.object({
  eventId: z.string().uuid(),
  attending: z.boolean(),
  plusOneAttending: z.boolean().optional(),
  plusOneName: z.string().max(200).optional(),
  dietaryRequirements: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, plus_one_eligible")
    .eq("rsvp_token", token)
    .maybeSingle();

  if (contactError || !contact) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  const body = rsvpSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const {
    eventId,
    attending,
    plusOneAttending,
    plusOneName,
    dietaryRequirements,
    notes,
  } = body.data;

  const { error: upsertError } = await supabase.from("rsvps").upsert(
    {
      contact_id: contact.id,
      event_id: eventId,
      attending,
      plus_one_attending: contact.plus_one_eligible ? plusOneAttending ?? false : false,
      plus_one_name: contact.plus_one_eligible ? plusOneName ?? null : null,
      dietary_requirements: dietaryRequirements ?? null,
      notes: notes ?? null,
      responded_at: new Date().toISOString(),
    },
    { onConflict: "contact_id,event_id" }
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  await supabase
    .from("contacts")
    .update({ rsvp_status: attending ? "attending" : "declined" })
    .eq("id", contact.id);

  return NextResponse.json({ ok: true });
}
