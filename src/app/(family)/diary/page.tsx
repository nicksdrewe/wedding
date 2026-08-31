import Link from "next/link";
import { Calendar, Check, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { InView } from "@/components/motion-primitives/in-view";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

type TimelineItem =
  | { kind: "event"; id: string; date: string; title: string; slug: string; isPast: boolean }
  | { kind: "milestone"; id: string; date: string; title: string; fromDecision: boolean; source: string; categoryTitle: string | null };

export default async function DiaryPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isCouple = profile?.role === "couple";

  const [{ data: events }, { data: entries }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, slug, starts_at, show_on_diary")
      .eq("show_on_diary", true)
      .not("starts_at", "is", null)
      .order("starts_at"),
    supabase
      .from("diary_entries")
      .select("id, title, entry_date, source, category_pages(title, slug)")
      .order("entry_date"),
  ]);

  const now = new Date();

  const eventItems: TimelineItem[] = (events ?? [])
    .filter((e) => e.slug)
    .map((e) => ({
      kind: "event",
      id: e.id,
      date: e.starts_at as string,
      title: e.name,
      slug: e.slug as string,
      isPast: new Date(e.starts_at as string) < now,
    }));

  const milestoneItems: TimelineItem[] = (entries ?? []).map((e) => {
    const cat = Array.isArray(e.category_pages) ? e.category_pages[0] : e.category_pages;
    return {
      kind: "milestone",
      id: e.id,
      date: e.entry_date,
      title: e.title,
      fromDecision: e.source !== "manual" && !!cat,
      source: e.source,
      categoryTitle: cat?.title ?? null,
    };
  });

  const timeline = [...eventItems, ...milestoneItems].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Us"
          title="Diary"
          infoText="Every event and key date, in one shared timeline."
        />
        {isCouple && (
          <Link
            href="/diary/events/new"
            className="flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 font-serif text-sm text-cream transition-colors duration-150 hover:bg-ink-soft"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add event
          </Link>
        )}
      </div>

      {isCouple && (
        <p className="mt-3">
          <Link href="/diary/events" className="font-serif text-xs tracking-[0.06em] text-ink-soft uppercase hover:text-accent">
            Manage all events →
          </Link>
        </p>
      )}

      {timeline.length === 0 ? (
        <EmptyState
          className="mt-9"
          title="Nothing logged yet"
          hint="Events you add, and dates from category decisions, show up here automatically."
        />
      ) : (
        <ol className="relative mt-9 flex flex-col gap-6">
          {/* The connecting line — positioned to run through the centre of
              the big event markers (20px wide, so 10px from the left edge
              of this padded list) rather than the smaller milestone dots,
              since events are the visual backbone of this timeline. */}
          <div aria-hidden="true" className="absolute top-2 bottom-2 left-[10px] w-px bg-ink/10" />

          {timeline.map((item, i) => (
            <InView
              key={`${item.kind}-${item.id}`}
              as="li"
              once
              className="relative flex items-start gap-4 pl-0"
              variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0 } }}
              transition={{ duration: 0.4, delay: Math.min(i, 12) * 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              {item.kind === "event" ? (
                <span
                  aria-hidden="true"
                  className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    item.isPast ? "bg-accent text-cream" : "border-2 border-ink/25 bg-cream text-ink-soft"
                  }`}
                >
                  {item.isPast ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : (
                    <Calendar className="h-2.5 w-2.5" strokeWidth={2.5} />
                  )}
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className={`relative z-10 mt-1.5 ml-1.5 h-2 w-2 shrink-0 rounded-full ${
                    item.fromDecision ? "bg-accent" : "bg-cream-deep ring-1 ring-inset ring-ink/15"
                  }`}
                />
              )}

              <div
                className={
                  item.kind === "event"
                    ? "flex-1 rounded-[10px] border border-ink/10 bg-white p-4 transition-colors duration-150 hover:border-accent/40"
                    : "flex-1"
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-serif text-[11px] font-medium tracking-[0.06em] text-ink-soft uppercase">
                    {new Date(item.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  {item.kind === "event" && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium tracking-[0.04em] uppercase ${
                        item.isPast ? "bg-accent/12 text-accent" : "bg-cream-deep text-ink-soft"
                      }`}
                    >
                      {item.isPast ? "Completed" : "Upcoming"}
                    </span>
                  )}
                </div>

                {item.kind === "event" ? (
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <Link href={`/events/${item.slug}`} className="font-serif text-sm font-semibold hover:text-accent">
                      {item.title}
                    </Link>
                    {isCouple && (
                      <Link
                        href={`/diary/events/${item.id}/edit`}
                        className="shrink-0 font-serif text-[11px] tracking-[0.06em] text-ink-soft uppercase hover:text-accent"
                      >
                        Edit
                      </Link>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="mt-0.5 font-serif text-sm font-semibold">{item.title}</p>
                    {item.fromDecision && (
                      <p className="mt-1 font-reading text-[13px] text-accent italic">
                        ← from Categories · {item.categoryTitle}
                        {item.source === "page_option" ? ", winner selected" : ""}
                      </p>
                    )}
                  </>
                )}
              </div>
            </InView>
          ))}
        </ol>
      )}
    </div>
  );
}
