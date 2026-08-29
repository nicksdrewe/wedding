import { createClient } from "@/lib/supabase/server";

export default async function DiaryPage() {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("diary_entries")
    .select("id, title, entry_date, source, category_pages(title, slug)")
    .order("entry_date");

  return (
    <div>
      <h1 className="font-display text-[34px] tracking-tight">Organiser Diary</h1>
      <p className="mt-2 font-reading text-[15px] text-ink-soft">
        Every key date logged across categories, in one shared timeline.
      </p>

      <ul className="mt-9 flex flex-col gap-6">
        {(entries ?? []).map((e) => {
          const cat = Array.isArray(e.category_pages)
            ? e.category_pages[0]
            : e.category_pages;
          const fromDecision = e.source !== "manual" && cat;
          return (
            <li key={e.id} className="flex items-start gap-5">
              <div
                aria-hidden="true"
                className="mt-1.5 w-[2px] self-stretch rounded-full"
                style={{
                  background: fromDecision
                    ? "linear-gradient(var(--color-accent), rgba(76,107,82,0.15))"
                    : "var(--color-cream-deep)",
                }}
              />
              <div>
                <p className="font-serif text-sm font-semibold">
                  {e.entry_date} — {e.title}
                </p>
                {fromDecision && (
                  <p className="mt-1.5 font-reading text-[13px] text-accent italic">
                    ← from Categories · {cat.title}
                    {e.source === "page_option" ? ", winner selected" : ""}
                  </p>
                )}
              </div>
            </li>
          );
        })}
        {(!entries || entries.length === 0) && (
          <p className="font-reading text-ink-soft">
            Nothing logged yet — dates added on category pages show up here
            automatically.
          </p>
        )}
      </ul>
    </div>
  );
}
