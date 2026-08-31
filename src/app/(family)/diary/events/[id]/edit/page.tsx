import { redirect, notFound } from "next/navigation";
import { getAuthState } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { EventForm, type EventFormData } from "../../EventForm";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const state = await getAuthState();
  if (state.status !== "ok" || state.profile.role !== "couple") redirect("/no-access");

  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, name, slug, starts_at, location, is_landing_cta, landing_cta_eyebrow, landing_cta_heading, landing_cta_body, landing_cta_copy, rsvp_enabled, rsvp_open, plus_ones_open, show_rsvp_form, show_guest_list_column, show_header, header_eyebrow, header_title, header_body, show_photo_board, show_details, details_eyebrow, details_title, venue_name, venue_body, show_map, show_on_diary"
    )
    .eq("id", id)
    .maybeSingle();

  if (!event) notFound();

  return (
    <div>
      <PageHeader
        eyebrow="Us"
        title={`Edit ${event.name}`}
        description="Tick on whatever this event needs — each one reveals what to fill in for it."
      />
      <div className="mt-8 max-w-2xl">
        <EventForm event={event as EventFormData} />
      </div>
    </div>
  );
}
