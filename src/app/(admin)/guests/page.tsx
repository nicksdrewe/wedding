import { AnimatedHeading } from "@/components/AnimatedHeading";
import { createClient } from "@/lib/supabase/server";
import { InView } from "@/components/motion-primitives/in-view";
import { AddContactForm } from "./AddContactForm";

const STATUS_STYLE: Record<string, string> = {
  attending: "bg-accent/15 text-accent",
  declined: "bg-alert/15 text-alert",
  pending: "bg-cream-deep text-ink-soft",
};

export default async function GuestsPage() {
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, full_name, email, phone, role, tags, plus_one_eligible, rsvp_status, rsvp_token")
    .order("full_name");

  return (
    <div>
      <AnimatedHeading className="font-display text-[34px] tracking-tight">Guest List</AnimatedHeading>
      <p className="mt-2 font-reading text-[15px] text-ink-soft">
        Your working guest list — doubles as the CRM for RSVP links, tags,
        and reminders.
      </p>

      <AddContactForm />

      <div className="mt-10 overflow-x-auto rounded-[8px] border border-ink/10">
        <table className="w-full min-w-[640px] text-left font-serif text-[13px]">
          <thead className="bg-cream-deep">
            <tr>
              <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Name</th>
              <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Email</th>
              <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Role</th>
              <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Tags</th>
              <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Plus one</th>
              <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">RSVP</th>
            </tr>
          </thead>
          <tbody>
            {(contacts ?? []).map((c, i) => (
              <InView
                key={c.id}
                as="tr"
                once
                variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03 }}
                className="border-t border-ink/8"
              >
                <td className="px-5 py-3.5">{c.full_name}</td>
                <td className="px-5 py-3.5">{c.email}</td>
                <td className="px-5 py-3.5 capitalize">{c.role.replace("_", " ")}</td>
                <td className="px-5 py-3.5">{c.tags?.join(", ")}</td>
                <td className="px-5 py-3.5">{c.plus_one_eligible ? "Yes" : "No"}</td>
                <td className="px-5 py-3.5">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] tracking-wide uppercase ${
                      STATUS_STYLE[c.rsvp_status] ?? STATUS_STYLE.pending
                    }`}
                  >
                    {c.rsvp_status}
                  </span>
                </td>
              </InView>
            ))}
            {(!contacts || contacts.length === 0) && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center font-reading text-ink-soft">
                  No guests yet — add your first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
