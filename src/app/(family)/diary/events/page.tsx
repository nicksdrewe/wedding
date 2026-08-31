import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getAuthState } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

// Every event, regardless of whether it currently shows on the diary
// timeline (it might have no date set yet, or show_on_diary off) — the
// timeline is a filtered view of events, not the only place one can be
// reached from. Couple-only, same inline check as new/[id]/edit.
export default async function EventsListPage() {
  const state = await getAuthState();
  if (state.status !== "ok" || state.profile.role !== "couple") redirect("/no-access");

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, slug, starts_at, is_landing_cta, rsvp_enabled, show_on_diary")
    .order("starts_at", { nullsFirst: false });

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader eyebrow="Us" title="All events" description="Every event, whether or not it's set to show on the diary timeline." />
        <Link
          href="/diary/events/new"
          className="flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 font-serif text-sm text-cream transition-colors duration-150 hover:bg-ink-soft"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Add event
        </Link>
      </div>

      <p className="mt-4">
        <Link href="/diary" className="font-serif text-xs tracking-[0.06em] text-ink-soft uppercase hover:text-accent">
          ← Back to the timeline
        </Link>
      </p>

      {!events || events.length === 0 ? (
        <EmptyState className="mt-9" title="No events yet" hint="Add your first one above." />
      ) : (
        <div className="mt-9 overflow-x-auto rounded-[10px] border border-ink/10">
          <table className="w-full min-w-[600px] text-left font-serif text-[13px]">
            <thead className="bg-cream-deep">
              <tr>
                <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Name</th>
                <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Date</th>
                <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Status</th>
                <th className="px-5 py-3 text-right text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {events.map((e) => (
                <tr key={e.id} className="transition-colors duration-150 hover:bg-cream-deep/40">
                  <td className="px-5 py-3.5 font-medium text-ink">{e.name}</td>
                  <td className="px-5 py-3.5 text-ink-soft">
                    {e.starts_at
                      ? new Date(e.starts_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                      : "No date set"}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {e.is_landing_cta && (
                        <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[10px] font-medium tracking-[0.04em] text-accent uppercase">
                          Home CTA
                        </span>
                      )}
                      {e.rsvp_enabled && (
                        <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[10px] font-medium tracking-[0.04em] text-ink-soft uppercase">
                          RSVPs on
                        </span>
                      )}
                      {!e.show_on_diary && (
                        <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[10px] font-medium tracking-[0.04em] text-ink-soft uppercase">
                          Hidden from diary
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/diary/events/${e.id}/edit`}
                      className="font-serif text-[11px] tracking-[0.06em] text-ink-soft uppercase hover:text-accent"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
