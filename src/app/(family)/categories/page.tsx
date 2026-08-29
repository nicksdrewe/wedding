import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { InView } from "@/components/motion-primitives/in-view";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { NewCategoryForm } from "./NewCategoryForm";

export default async function CategoriesPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: pages } = await supabase
    .from("category_pages")
    .select("id, slug, title, category_costs(predicted_cost, actual_cost)")
    .order("title");

  const hasCategories = !!pages && pages.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Planning"
        title="Categories"
        description="Venue, outfits, flowers, catering — everything with a cost, a contact, or a date lives here."
      />

      {profile?.role === "couple" && <NewCategoryForm />}

      {hasCategories ? (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {pages.map((p, i) => {
            const cost = Array.isArray(p.category_costs)
              ? p.category_costs[0]
              : p.category_costs;
            return (
              <InView
                key={p.id}
                as="div"
                once
                variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  href={`/categories/${p.slug}`}
                  className="group block rounded-[10px] border border-ink/10 bg-white p-5 transition-colors duration-150 hover:border-accent/40 hover:bg-accent/[0.03]"
                >
                  <h2 className="font-serif text-[15px] font-semibold text-ink transition-colors duration-150 group-hover:text-accent">
                    {p.title}
                  </h2>
                  <p className="mt-1.5 font-reading text-[13px] text-ink-soft">
                    Predicted £{cost?.predicted_cost ?? "—"} · Actual £
                    {cost?.actual_cost ?? "—"}
                  </p>
                </Link>
              </InView>
            );
          })}
        </div>
      ) : (
        <EmptyState
          className="mt-8"
          title="No categories yet"
          hint="Add your first one above to start tracking costs, contacts, and dates."
        />
      )}
    </div>
  );
}
