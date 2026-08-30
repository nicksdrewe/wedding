import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { createClient } from "@/lib/supabase/server";
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
  const [{ data: contacts }, { token: activeInviteToken }, { data: engagementEvent }] = await Promise.all([
    supabase
      .from("contacts")
      .select(
        "id, full_name, email, phone, role, tags, plus_one_eligible, rsvp_status, rsvp_token, parent_contact_id, rsvps(event_id, attending)"
      )
      .order("full_name"),
    getActiveInviteLink(),
    supabase.from("events").select("id").eq("name", "Engagement Party").maybeSingle(),
  ]);

  function engagementRsvpStatus(rsvps: { event_id: string; attending: boolean | null }[] | null) {
    const rsvp = rsvps?.find((r) => r.event_id === engagementEvent?.id);
    if (!rsvp || rsvp.attending === null) return "pending";
    return rsvp.attending ? "attending" : "declined";
  }

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
