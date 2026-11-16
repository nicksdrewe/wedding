import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getEffectivePermission } from "@/lib/permissions/actions";
import { PageHeader } from "@/components/PageHeader";
import { loadCategoryTree } from "@/lib/categories/load";
import { PlanTotals } from "@/components/ui/PlanTotals";
import { loadCategoryFeedback } from "@/lib/categories/feedback";
import { CategoriesView } from "./CategoriesView";

export default async function CategoriesPage() {
  const profile = await getCurrentProfile();
  const permission = await getEffectivePermission("categories", profile);
  if (!permission.pageAccess) redirect("/no-access");
  // Creating, renaming, moving and deleting whole categories is the couple's
  // alone (category_pages' write policies) — NOT edit_access, which best man /
  // maid of honour also hold and which only covers a category's contents.
  const isCouple = profile?.role === "couple";

  // Every category this person can see, as a tree, with costs rolled up from
  // options (lib/categories). Prices a viewer may not see are simply absent.
  // The main wedding's only: the stag and hen plans live on their own boards.
  const { roots } = await loadCategoryTree(profile);

  const feedback = await loadCategoryFeedback(roots, profile?.id ?? null);

  return (
    <div>
      <PageHeader
        eyebrow="Planning"
        title="Categories"
        infoText="Everything with a cost, a contact or a date. Categories can sit inside each other; each one's cost is worked out from its options and everything inside it."
      />
      <div className="mt-6"><PlanTotals roots={roots} /></div>
      <CategoriesView
        roots={roots}
        canManage={isCouple}
        basePath="/categories"
        feedback={feedback}
        interact={{ canInteract: !!profile && profile.role !== "guest", canModerate: isCouple, revalidate: "/categories" }}
      />
    </div>
  );
}
