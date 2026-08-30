import React from "react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { InView } from "@/components/motion-primitives/in-view";
import { getActiveInviteLink } from "@/lib/invite/actions";
import { AddContactForm } from "./AddContactForm";
import { EditableGuestRow } from "./EditableGuestRow";
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

  // Group child contacts (e.g. "others" added via the engagement party's
  // group RSVP — see 0011_contact_hierarchy.sql) directly beneath their
  // parent instead of mixed into the alphabetical list as their own
  // top-level rows. This only changes row POSITION — every contact is
  // still fetched and still counted above, nothing is filtered out.
  const topLevelContacts = (contacts ?? []).filter((c) => !c.parent_contact_id);
  const childrenByParent = new Map<string, typeof topLevelContacts>();
  for (const c of contacts ?? []) {
    if (!c.parent_contact_id) continue;
    const siblings = childrenByParent.get(c.parent_contact_id) ?? [];
    siblings.push(c);
    childrenByParent.set(c.parent_contact_id, siblings);
  }
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
        <div className="mt-10 overflow-x-auto rounded-[10px] border border-ink/10">
          <table className="w-full min-w-[720px] text-left font-serif text-[13px]">
            <thead className="bg-cream-deep">
              <tr>
                <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Name</th>
                <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Contact</th>
                <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Role</th>
                <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Tags</th>
                <th className="px-5 py-3 text-center text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                  Plus one
                </th>
                <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                  Wedding RSVP
                </th>
                <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                  Engagement RSVP
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {topLevelContacts.map((c, i) => (
                <React.Fragment key={c.id}>
                  <InView
                    as="tr"
                    once
                    variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                    transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03 }}
                    className="group transition-colors duration-150 hover:bg-cream-deep/40"
                  >
                    <EditableGuestRow
                      contact={c}
                      isCouple={isCouple}
                      engagementRsvpStatus={engagementRsvpStatus(c.rsvps)}
                    />
                  </InView>
                  {(childrenByParent.get(c.id) ?? []).map((child) => (
                    <InView
                      key={child.id}
                      as="tr"
                      once
                      variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                      transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03 }}
                      className="group bg-cream-deep/20 transition-colors duration-150 hover:bg-cream-deep/40"
                    >
                      <EditableGuestRow
                        contact={child}
                        isCouple={isCouple}
                        isChild
                        engagementRsvpStatus={engagementRsvpStatus(child.rsvps)}
                      />
                    </InView>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
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
