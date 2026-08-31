import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import { getActiveInviteLink } from "@/lib/invite/actions";
import { AddContactForm } from "./AddContactForm";
import { GuestTable, type GuestTableContact } from "./GuestTable";
import { InviteLinkCard } from "./InviteLinkCard";

export default async function GuestsPage() {
  const supabase = await createClient();
  // contacts.rsvp_status only ever reflects the WEDDING rsvp (see
  // api/rsvp/[token]/route.ts, the only writer of that column, on its own
  // separate personal-invite-link flow that the events system below
  // doesn't touch) — every OTHER event's RSVP instead upserts into the
  // shared `rsvps` table keyed by event_id. Pulling every rsvps row per
  // contact (not filtered to one event) and picking each flagged event's
  // out of it in JS, rather than a per-event filtered query, so a contact
  // with no rsvp at all for a given event still gets listed as "pending"
  // instead of being silently dropped from the result set entirely.
  const [{ data: contacts }, { token: activeInviteToken }, { data: columnEvents }, { data: weddingEvent }] =
    await Promise.all([
    supabase
      .from("contacts")
      // rsvp_token deliberately excluded — it's a per-guest, unauthenticated
      // capability URL (whoever has it can RSVP as that person, no login
      // required), and nothing in the guest table UI actually uses it. A
      // "use client" component's props are serialized into the page's own
      // HTML, so selecting it here would ship every guest's token to
      // whoever's viewing this page for no reason.
      .select(
        "id, full_name, email, phone, role, tags, plus_one_eligible, rsvp_status, parent_contact_id, rsvps(event_id, attending, plus_one_attending)"
      )
      .order("full_name"),
    getActiveInviteLink(),
    // Every event that's opted into its own guest-list column (see
    // 0017_events_system.sql) — the couple's own toggle in the event
    // form, not a hardcoded list of which events exist.
    supabase
      .from("events")
      .select("id, name")
      .eq("show_guest_list_column", true)
      .order("starts_at", { nullsFirst: false }),
    // The wedding's own RSVP column/card is a different data source
    // (contacts.rsvp_status, written by the personal invite-link flow at
    // api/rsvp/[token]) from the events-system toggle above, but it
    // should follow the exact same principle: don't show it as if it's
    // live until the couple has actually turned RSVPs on for the Wedding
    // event (see 0021_wedding_event.sql, created with rsvp_enabled off by
    // default) — otherwise this reads as an active RSVP nobody can
    // actually respond to yet.
    supabase.from("events").select("id, rsvp_enabled").eq("name", "Wedding").maybeSingle(),
  ]);

  const events = columnEvents ?? [];
  const showWeddingRsvp = weddingEvent?.rsvp_enabled ?? false;

  function rsvpStatusFor(
    rsvps: { event_id: string; attending: boolean | null }[] | null,
    eventId: string
  ) {
    const rsvp = rsvps?.find((r) => r.event_id === eventId);
    if (!rsvp || rsvp.attending === null) return "pending";
    return rsvp.attending ? "attending" : "declined";
  }

  // A generic event's plus-ones are their own contact rows with their own
  // rsvps row each, so a plain count of "attending" rows already includes
  // them — no +1 arithmetic needed there. The wedding flow works
  // differently: a plus-one is a boolean (plus_one_attending) on the SAME
  // contact's rsvps row rather than a separate contact, so counting
  // "including +1s" for it means adding one for each attending row that
  // also has it set.
  function countConfirmed(
    eventId: string | undefined,
    rsvps: { event_id: string; attending: boolean | null; plus_one_attending: boolean | null }[] | null,
    { includePlusOne }: { includePlusOne: boolean }
  ) {
    if (!eventId) return 0;
    const rsvp = rsvps?.find((r) => r.event_id === eventId);
    if (!rsvp?.attending) return 0;
    return includePlusOne && rsvp.plus_one_attending ? 2 : 1;
  }

  const confirmedByEvent = events.map((e) => ({
    id: e.id,
    name: e.name,
    confirmed: (contacts ?? []).reduce(
      (sum, c) => sum + countConfirmed(e.id, c.rsvps, { includePlusOne: false }),
      0
    ),
  }));

  const hasContacts = !!contacts && contacts.length > 0;

  // Sorting/grouping/filtering all now happen client-side in GuestTable —
  // it just needs each flagged event's status pre-computed and merged
  // onto each contact rather than kept as a separate lookup, since it
  // filters and sorts these as plain objects.
  const guestTableContacts: GuestTableContact[] = (contacts ?? []).map((c) => ({
    ...c,
    eventRsvpStatuses: Object.fromEntries(events.map((e) => [e.id, rsvpStatusFor(c.rsvps, e.id)])),
  }));

  // This whole route is already gated to the couple role in the (admin)
  // layout (redirects everyone else to /no-access), so edit/delete controls
  // are always shown here — the isCouple prop just keeps the component in
  // line with the same pattern used on family-visible surfaces.
  const isCouple = true;

  return (
    <div>
      <PageHeader
        eyebrow="Household"
        title="Guest List"
        description="Your working guest list — doubles as the CRM for RSVP links, tags, and reminders."
      />

      {/* Confirmed counts, front and centre — the numbers people actually
          come to this page for, same treatment as the budget page's
          running totals. One card per event opted into a guest-list
          column, plus the wedding's own separate RSVP track. */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {confirmedByEvent.map((e) => (
          <div key={e.id} className="rounded-[10px] border border-ink/10 bg-white px-5 py-4">
            <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
              {e.name} — confirmed
            </p>
            <p className="mt-1.5 font-display text-[26px] tracking-tight tabular-nums">
              <AnimatedNumber value={e.confirmed} springOptions={{ bounce: 0 }} />
            </p>
          </div>
        ))}
        {showWeddingRsvp && (
          <div className="rounded-[10px] border border-ink/10 bg-white px-5 py-4">
            <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
              Wedding — confirmed (incl. +1s)
            </p>
            <p className="mt-1.5 font-display text-[26px] tracking-tight tabular-nums">
              <AnimatedNumber
                value={(contacts ?? []).reduce(
                  (sum, c) => sum + countConfirmed(weddingEvent?.id, c.rsvps, { includePlusOne: true }),
                  0
                )}
                springOptions={{ bounce: 0 }}
              />
            </p>
          </div>
        )}
      </div>

      <InviteLinkCard initialToken={activeInviteToken} />

      <AddContactForm />

      {hasContacts ? (
        <GuestTable
          contacts={guestTableContacts}
          events={events}
          showWeddingRsvp={showWeddingRsvp}
          isCouple={isCouple}
        />
      ) : (
        <EmptyState
          className="mt-10"
          title="No guests yet"
          hint="Add your first guest above and they'll show up here."
        />
      )}
    </div>
  );
}
