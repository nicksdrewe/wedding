import { createClient } from "@/lib/supabase/server";

export default async function DiaryPage() {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("diary_entries")
    .select("id, title, entry_date, source, category_pages(title, slug)")
    .order("entry_date");

  return (
    <div>
      <h1 className="font-script text-4xl">Organiser Diary</h1>
      <p className="mt-2 font-serif text-ink-soft">
        Every key date logged across categories, in one shared timeline.
      </p>

      <ul className="mt-8 flex flex-col gap-3">
        {(entries ?? []).map((e) => {
          const cat = Array.isArray(e.category_pages)
            ? e.category_pages[0]
            : e.category_pages;
          return (
            <li
              key={e.id}
              className="flex items-center justify-between rounded-2xl border border-ink/10 bg-cream-deep/50 px-5 py-3 font-serif text-sm"
            >
              <span>
                <span className="font-semibold">{e.entry_date}</span> —{" "}
                {e.title}
              </span>
              {cat && <span className="text-ink-soft">{cat.title}</span>}
            </li>
          );
        })}
        {(!entries || entries.length === 0) && (
          <p className="font-serif text-ink-soft">
            Nothing logged yet — dates added on category pages show up here
            automatically.
          </p>
        )}
      </ul>
    </div>
  );
}
