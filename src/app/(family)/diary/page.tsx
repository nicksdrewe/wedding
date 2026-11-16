import Link from "next/link";
import { Calendar, Check, Flag, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getEffectivePermission } from "@/lib/permissions/actions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Timeline, type TimelineEntry } from "@/components/timeline/Timeline";
import { CommKindIcon } from "@/lib/org-comms/kind-icon";
import { commShortTitle, importanceToTier } from "@/lib/org-comms/types";

type DiaryItem =
  | { kind: "event"; id: string; date: string; title: string; slug: string; isPast: boolean }
  | { kind: "milestone"; id: string; date: string; title: string; fromDecision: boolean; source: string; categoryTitle: string | null }
  | { kind: "comm"; id: string; date: string; title: string; commKind: string; importance: number };

export default async function DiaryPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isCouple = profile?.role === "couple";
  // Milestones (diary_entries sourced from category decisions) are the
  // "nodes pulled through from other tabs" that guests and plain
  // wedding_party members shouldn't see here — only events should. Using
  // pageAccess on "categories" as a proxy for "does this viewer have
  // broad planning visibility": true for couple/family/best_man/
  // maid_of_honour, false for guest/plain wedding_party per 0028's seeded
  // permissions.
  const showMilestones = (await getEffectivePermission("categories", profile)).pageAccess;

  const [{ data: events }, { data: entries }, commsResult] = await Promise.all([
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
    // Organising comms (0043): RLS returns only what this viewer may see, and
    // an error (table not there yet) just means no comms on the timeline.
    supabase
      .from("org_comms")
      .select("id, kind, counterparty, subject, occurred_on, importance")
      .order("occurred_on", { ascending: false })
      .limit(200),
  ]);
  const comms = commsResult.error ? [] : (commsResult.data ?? []);

  const now = new Date();

  const eventItems: DiaryItem[] = (events ?? [])
    .filter((e) => e.slug)
    .map((e) => ({
      kind: "event",
      id: e.id,
      date: e.starts_at as string,
      title: e.name,
      slug: e.slug as string,
      isPast: new Date(e.starts_at as string) < now,
    }));

  const milestoneItems: DiaryItem[] = (entries ?? []).map((e) => {
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

  const commItems: DiaryItem[] = comms.map((c) => ({
    kind: "comm",
    id: c.id as string,
    date: c.occurred_on as string,
    title: commShortTitle(c as { kind: string; counterparty: string | null; subject: string }),
    commKind: c.kind as string,
    importance: c.importance as number,
  }));

  const timeline = [...eventItems, ...(showMilestones ? milestoneItems : []), ...commItems].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const items: TimelineEntry[] = timeline.map((item) => {
    if (item.kind === "event") {
      return {
        id: `event-${item.id}`,
        date: item.date,
        title: item.title,
        href: `/events/${item.slug}`,
        tier: "milestone",
        icon: item.isPast ? <Check strokeWidth={3} aria-hidden="true" /> : <Calendar strokeWidth={2.5} aria-hidden="true" />,
        chips: <span className={`chip ${item.isPast ? "chip-sec" : ""}`}>{item.isPast ? "Completed" : "Upcoming"}</span>,
        children: isCouple ? (
          <p className="tl-actions">
            <Link href={`/diary/events/${item.id}/edit`} className="btn btn-quiet btn-sm">
              Edit event
            </Link>
          </p>
        ) : undefined,
      };
    }
    if (item.kind === "milestone") {
      return {
        id: `entry-${item.id}`,
        date: item.date,
        title: item.title,
        tier: "standard",
        icon: <Flag strokeWidth={2.5} aria-hidden="true" />,
        excerpt: item.fromDecision
          ? `From Categories · ${item.categoryTitle}${item.source === "page_option" ? ", winner selected" : ""}`
          : null,
      };
    }
    return {
      id: `comm-${item.id}`,
      date: item.date,
      title: item.title,
      href: `/organising?entry=${item.id}`,
      tier: importanceToTier(item.importance),
      icon: <CommKindIcon kind={item.commKind} />,
    };
  });

  return (
    <div>
      <PageHeader
        eyebrow="Us"
        title="Diary"
        infoText="Every event and key date, in one shared timeline."
        actions={
          isCouple && (
            <Link href="/diary/events/new" className="btn btn-on-dark">
              <Plus className="h-4 w-4" strokeWidth={2} />
              Add event
            </Link>
          )
        }
      />

      {isCouple && (
        <p className="-mt-3">
          <Link href="/diary/events" className="font-serif text-xs tracking-[0.06em] text-ink-soft uppercase hover:text-sec">
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
        <div className="mt-9">
          <Timeline items={items} />
        </div>
      )}
    </div>
  );
}
