import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { EventPageClient, type EventConfig } from "./EventPageClient";

// Server wrapper: fetches the event's own config (which sections are on
// and their content), its photos, and whether the current visitor is the
// couple — this page has no auth requirement of its own, same as the
// engagement party page it generalizes. Kept as a thin wrapper rather
// than converting the whole page to a server component, since the
// gallery/RSVP form/scroll reveals all need client state and event
// handlers.
//
// Admin client, not the session-aware one: this page is publicly reachable
// (anonymous guests RSVP here), and events' RLS ("read events") requires
// auth.uid() is not null — a signed-out visitor got zero rows back here,
// hitting notFound() for every event page (see src/app/page.tsx for the
// same bug on the home page CTA lookup). Only non-sensitive event config
// is selected below, so bypassing RLS is safe.
export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, slug, name, starts_at, location, show_header, header_eyebrow, header_title, header_body, show_photo_board, show_details, details_eyebrow, details_title, venue_name, venue_body, show_map, show_rsvp_form, rsvp_enabled"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!event) notFound();

  const { data: photos } = await supabase
    .from("engagement_photos")
    .select("id, image_url, caption")
    .eq("event_id", event.id)
    .order("sort_order");

  const profile = await getCurrentProfile();
  const isCouple = profile?.role === "couple";

  return <EventPageClient event={event as EventConfig} photos={photos ?? []} isCouple={isCouple} />;
}
