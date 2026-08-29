import { createClient } from "@/lib/supabase/server";
import { InView } from "@/components/motion-primitives/in-view";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default async function DiaryPage() {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("diary_entries")
    .select("id, title, entry_date, source, category_pages(title, slug)")
    .order("entry_date");

  return (
    <div>
      <PageHeader
        eyebrow="Us"
        title="Organiser Diary"
        description="Every key date logged across categories, in one shared timeline."
      />

      {(!entries || entries.length === 0) ? (
        <EmptyState
          className="mt-9"
          title="Nothing logged yet"
          hint="Dates added on category pages show up here automatically."
        />
      ) : (
        <ul className="mt-9 flex flex-col gap-3">
          {entries.map((e, i) => {
            const cat = Array.isArray(e.category_pages)
              ? e.category_pages[0]
              : e.category_pages;
            const fromDecision = e.source !== "manual" && cat;
            return (
              <InView
                key={e.id}
                as="li"
                once
                className="flex items-start gap-4 rounded-[10px] border border-ink/10 bg-white p-4 transition-colors duration-150 hover:border-accent/40"
                variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0 } }}
                transition={{ duration: 0.4, delay: Math.min(i, 10) * 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                <div
                  aria-hidden="true"
                  className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                    fromDecision ? "bg-accent" : "bg-cream-deep ring-1 ring-inset ring-ink/15"
                  }`}
                />
                <div>
                  <p className="font-serif text-[11px] font-medium tracking-[0.06em] text-ink-soft uppercase">
                    {e.entry_date}
                  </p>
                  <p className="mt-0.5 font-serif text-sm font-semibold">{e.title}</p>
                  {fromDecision && (
                    <p className="mt-1.5 font-reading text-[13px] text-accent italic">
                      ← from Categories · {cat.title}
                      {e.source === "page_option" ? ", winner selected" : ""}
                    </p>
                  )}
                </div>
              </InView>
            );
          })}
        </ul>
      )}
    </div>
  );
}
