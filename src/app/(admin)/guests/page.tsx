import React from "react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { InView } from "@/components/motion-primitives/in-view";
import { AddContactForm } from "./AddContactForm";
import { EditableGuestRow } from "./EditableGuestRow";

export default async function GuestsPage() {
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, full_name, email, phone, role, tags, plus_one_eligible, rsvp_status, rsvp_token, parent_contact_id")
    .order("full_name");

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
                <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">RSVP</th>
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
                    <EditableGuestRow contact={c} isCouple={isCouple} />
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
                      <EditableGuestRow contact={child} isCouple={isCouple} isChild />
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
