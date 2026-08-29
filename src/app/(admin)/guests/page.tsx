import {
  CircleCheck,
  CircleDashed,
  CircleX,
  Mail,
  Phone,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { InView } from "@/components/motion-primitives/in-view";
import { AddContactForm } from "./AddContactForm";

const ROLE_BADGE: Record<string, string> = {
  couple: "bg-accent text-cream",
  wedding_party: "bg-accent/12 text-accent border border-accent/25",
  family: "bg-ink/8 text-ink-soft border border-ink/15",
  guest: "bg-cream-deep text-ink-soft border border-ink/10",
};

const ROLE_LABEL: Record<string, string> = {
  couple: "Couple",
  wedding_party: "Wedding Party",
  family: "Family",
  guest: "Guest",
};

const RSVP_STYLE: Record<string, { className: string; icon: LucideIcon; label: string }> = {
  attending: { className: "bg-accent/12 text-accent", icon: CircleCheck, label: "Attending" },
  declined: { className: "bg-alert/12 text-alert", icon: CircleX, label: "Declined" },
  pending: { className: "bg-cream-deep text-ink-soft", icon: CircleDashed, label: "Pending" },
};

export default async function GuestsPage() {
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, full_name, email, phone, role, tags, plus_one_eligible, rsvp_status, rsvp_token")
    .order("full_name");

  const hasContacts = !!contacts && contacts.length > 0;

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
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {contacts.map((c, i) => {
                const rsvp = RSVP_STYLE[c.rsvp_status] ?? RSVP_STYLE.pending;
                const RsvpIcon = rsvp.icon;
                return (
                  <InView
                    key={c.id}
                    as="tr"
                    once
                    variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                    transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03 }}
                    className="transition-colors duration-150 hover:bg-cream-deep/40"
                  >
                    <td className="px-5 py-3.5 font-medium text-ink">{c.full_name}</td>
                    <td className="px-5 py-3.5 text-ink-soft">
                      <div className="flex flex-col gap-1">
                        {c.email && (
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-ink-soft/60" strokeWidth={2} />
                            {c.email}
                          </span>
                        )}
                        {c.phone && (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-ink-soft/60" strokeWidth={2} />
                            {c.phone}
                          </span>
                        )}
                        {!c.email && !c.phone && <span className="text-ink-soft/40">—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[0.02em] ${
                          ROLE_BADGE[c.role] ?? ROLE_BADGE.guest
                        }`}
                      >
                        {ROLE_LABEL[c.role] ?? c.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {c.tags && c.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.tags.map((tag: string) => (
                            <span
                              key={tag}
                              className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink-soft"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-ink-soft/30">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {c.plus_one_eligible ? (
                        <UserPlus className="mx-auto h-4 w-4 text-accent" strokeWidth={2} />
                      ) : (
                        <span className="text-ink-soft/30">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[0.02em] ${rsvp.className}`}
                      >
                        <RsvpIcon className="h-3.5 w-3.5" strokeWidth={2} />
                        {rsvp.label}
                      </span>
                    </td>
                  </InView>
                );
              })}
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
