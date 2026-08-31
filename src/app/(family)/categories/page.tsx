import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { InView } from "@/components/motion-primitives/in-view";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { NewCategoryForm } from "./NewCategoryForm";
import { CategoryCard } from "./CategoryCard";

export default async function CategoriesPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: pages } = await supabase
    .from("category_pages")
    .select("id, slug, title, category_costs(predicted_cost_min, predicted_cost_max, actual_cost, currency)")
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
                <CategoryCard
                  category={{
                    id: p.id,
                    slug: p.slug,
                    title: p.title,
                    predictedCostMin: cost?.predicted_cost_min ?? null,
                    predictedCostMax: cost?.predicted_cost_max ?? null,
                    actualCost: cost?.actual_cost ?? null,
                    currency: cost?.currency ?? "GBP",
                  }}
                  isCouple={profile?.role === "couple"}
                />
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
