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
  // api/rsvp/[token]/route.ts, the only writer of that column) — the
  // engagement party RSVP (api/engagement-rsvp/route.ts) instead
  // upserts into the shared `rsvps` table keyed by event_id, which is why
  // engagement respondents were showing as "pending" here even after
  // responding. Pulling every rsvps row per contact (not just the
  // engagement one) and picking the engagement event's out of it in JS,
  // rather than an inner-joined/filtered query, so a contact with no
  // engagement rsvp at all still gets listed as "pending" instead of being
  // silently dropped from the result set entirely.
  const [{ data: contacts }, { token: activeInviteToken }, { data: engagementEvent }, { data: weddingEvent }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select(
          "id, full_name, email, phone, role, tags, plus_one_eligible, rsvp_status, rsvp_token, parent_contact_id, rsvps(event_id, attending, plus_one_attending)"
        )
        .order("full_name"),
      getActiveInviteLink(),
      supabase.from("events").select("id").eq("name", "Engagement Party").maybeSingle(),
      supabase.from("events").select("id").eq("name", "Wedding").maybeSingle(),
    ]);

  function engagementRsvpStatus(rsvps: { event_id: string; attending: boolean | null }[] | null) {
    const rsvp = rsvps?.find((r) => r.event_id === engagementEvent?.id);
    if (!rsvp || rsvp.attending === null) return "pending";
    return rsvp.attending ? "attending" : "declined";
  }

  // Engagement plus-ones are their own contact rows with their own rsvps
  // row each (see api/engagement-rsvp/route.ts), so a plain count of
  // "attending" rows already includes them — no +1 arithmetic needed there.
  // The wedding flow works differently: a plus-one is a boolean
  // (plus_one_attending) on the SAME contact's rsvps row rather than a
  // separate contact (see api/rsvp/[token]/route.ts), so counting "including
  // +1s" means adding one for each attending row that also has it set.
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

  const engagementConfirmed = (contacts ?? []).reduce(
    (sum, c) => sum + countConfirmed(engagementEvent?.id, c.rsvps, { includePlusOne: false }),
    0
  );
  const weddingConfirmed = (contacts ?? []).reduce(
    (sum, c) => sum + countConfirmed(weddingEvent?.id, c.rsvps, { includePlusOne: true }),
    0
  );

  const hasContacts = !!contacts && contacts.length > 0;

  // Sorting/grouping/filtering all now happen client-side in GuestTable —
  // it just needs the engagement status pre-computed and merged onto each
  // contact rather than kept as a separate lookup, since it filters and
  // sorts these as plain objects.
  const guestTableContacts: GuestTableContact[] = (contacts ?? []).map((c) => ({
    ...c,
    engagementRsvpStatus: engagementRsvpStatus(c.rsvps),
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
          running totals. */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-[10px] border border-ink/10 bg-white px-5 py-4">
          <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
            Engagement party — confirmed
          </p>
          <p className="mt-1.5 font-display text-[26px] tracking-tight tabular-nums">
            <AnimatedNumber value={engagementConfirmed} springOptions={{ bounce: 0 }} />
          </p>
        </div>
        <div className="rounded-[10px] border border-ink/10 bg-white px-5 py-4">
          <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
            Wedding — confirmed (incl. +1s)
          </p>
          <p className="mt-1.5 font-display text-[26px] tracking-tight tabular-nums">
            <AnimatedNumber value={weddingConfirmed} springOptions={{ bounce: 0 }} />
          </p>
        </div>
      </div>

      <InviteLinkCard initialToken={activeInviteToken} />

      <AddContactForm />

      {hasContacts ? (
        <GuestTable contacts={guestTableContacts} isCouple={isCouple} />
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
