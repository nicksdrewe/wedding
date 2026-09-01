import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { CommsComposer, type CommsContact } from "./CommsComposer";

export default async function CommsPage() {
  // The (admin) layout now admits couple OR family (see 0028), but comms
  // must stay couple-only — this explicit check is the defense-in-depth
  // backstop for that, independent of the shared layout guard.
  const profile = await getCurrentProfile();
  if (profile?.role !== "couple") redirect("/no-access");

  const supabase = await createClient();

  const [{ data: contacts }, { data: rsvpEvents }, { data: messages }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, full_name, email, role, tags, rsvp_status, rsvps(event_id, attending)")
      .order("full_name"),
    // Every event with an open RSVP that's worth filtering an audience
    // by — the couple-managed set from the events system (see
    // 0017_events_system.sql), not a fixed "engagement"/"wedding" pair.
    supabase.from("events").select("id, name").eq("rsvp_enabled", true).order("starts_at", { nullsFirst: false }),
    supabase
      .from("comms_messages")
      .select("id, subject, created_at, comms_recipients(contact_id, email, status, sent_at, error)")
      .order("created_at", { ascending: false }),
  ]);

  const events = rsvpEvents ?? [];
  const nameByContactId = new Map((contacts ?? []).map((c) => [c.id, c.full_name]));

  function rsvpStatusFor(rsvps: { event_id: string; attending: boolean | null }[] | null, eventId: string) {
    const rsvp = rsvps?.find((r) => r.event_id === eventId);
    if (!rsvp || rsvp.attending === null) return "pending";
    return rsvp.attending ? "attending" : "declined";
  }

  // Only guests with an email on file can ever actually be sent anything
  // — filtered out here rather than left for the send step to discover
  // one at a time, so the audience picker only ever shows people this
  // could really reach.
  const commsContacts: CommsContact[] = (contacts ?? [])
    .filter((c) => !!c.email)
    .map((c) => ({
      id: c.id,
      full_name: c.full_name,
      email: c.email as string,
      role: c.role,
      tags: c.tags ?? [],
      eventStatuses: Object.fromEntries(events.map((e) => [e.id, rsvpStatusFor(c.rsvps, e.id)])),
    }));

  const history = (messages ?? []).map((m) => {
    const recipients = m.comms_recipients ?? [];
    return {
      id: m.id,
      subject: m.subject,
      createdAt: m.created_at,
      total: recipients.length,
      sent: recipients.filter((r) => r.status === "sent").length,
      failed: recipients.filter((r) => r.status === "failed").length,
      recipients: recipients.map((r) => ({
        name: nameByContactId.get(r.contact_id) ?? r.email,
        email: r.email,
        status: r.status,
        sentAt: r.sent_at,
        error: r.error,
      })),
    };
  });

  return (
    <div>
      <PageHeader
        eyebrow="Household"
        title="Guest Communications"
        infoText="Compose a message once, pick who it's for, and send — every send is logged so you always know who's already heard what."
      />

      {commsContacts.length > 0 ? (
        <CommsComposer contacts={commsContacts} events={events} history={history} />
      ) : (
        <EmptyState
          className="mt-10"
          title="No guests with an email yet"
          hint="Add an email address to a guest on the guest list before you can message them."
        />
      )}
    </div>
  );
}
