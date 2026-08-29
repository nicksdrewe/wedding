import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { NewCategoryForm } from "./NewCategoryForm";

export default async function CategoriesPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: pages } = await supabase
    .from("category_pages")
    .select("id, slug, title, category_costs(predicted_cost, actual_cost)")
    .order("title");

  return (
    <div>
      <h1 className="font-script text-4xl">Categories</h1>
      <p className="mt-2 font-serif text-ink-soft">
        Venue, outfits, flowers, catering — everything with a cost, a
        contact, or a date lives here.
      </p>

      {profile?.role === "couple" && <NewCategoryForm />}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {(pages ?? []).map((p) => {
          const cost = Array.isArray(p.category_costs)
            ? p.category_costs[0]
            : p.category_costs;
          return (
            <Link
              key={p.id}
              href={`/categories/${p.slug}`}
              className="rounded-2xl border border-ink/10 bg-cream-deep/50 p-5 transition hover:border-ink/30"
            >
              <h2 className="font-serif text-lg font-semibold">{p.title}</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Predicted: £{cost?.predicted_cost ?? "—"} · Actual: £
                {cost?.actual_cost ?? "—"}
              </p>
            </Link>
          );
        })}
        {(!pages || pages.length === 0) && (
          <p className="font-serif text-ink-soft">
            No categories yet — add your first one above.
          </p>
        )}
      </div>
    </div>
  );
}
