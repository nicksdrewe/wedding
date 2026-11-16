import { PlanTotals } from "./PlanTotals";
import { loadCategoryFeedback } from "@/lib/categories/feedback";
import type { CategoryNode } from "@/lib/categories/tree";
import { BOARDS, type BoardKey } from "@/lib/categories/boards";
import { CategoriesView } from "@/app/(family)/categories/CategoriesView";

// The planning area on the Wedding Planning page and on each stag / hen board: every plan (stag weekend,
// outfits...) as a tree with its costs added up, the same system as the main
// wedding's Categories. Admins (best man / maid of honour, and the couple)
// create and organise the plans; everyone on the board adds options, votes
// and comments inside them.
export async function BoardPlans({
  board,
  roots,
  isAdmin,
  profileId,
  canInteract,
  canHide = false,
}: {
  // null = the main wedding's own plans.
  board: BoardKey | null;
  roots: CategoryNode[];
  isAdmin: boolean;
  profileId: string | null;
  canInteract: boolean;
  // Best man / maid of honour: may hide a parent plan from the couple.
  canHide?: boolean;
}) {
  const cfg = board ? BOARDS[board] : null;
  const basePath = cfg ? cfg.plansPath : "/categories";
  const feedback = await loadCategoryFeedback(roots, profileId);
  return (
    <section className="mb-10">
      <div className="section-head">
        <h2 className="section-head__title">Plans</h2>
        <span className="section-head__rule" />
      </div>
      <PlanTotals roots={roots} expensesHref="/project/expenses" />
      <CategoriesView
        roots={roots}
        canManage={isAdmin}
        basePath={basePath}
        board={board}
        feedback={feedback}
        interact={{ canInteract, canModerate: isAdmin, canHide, revalidate: cfg ? cfg.plansPath.replace(/\/plans$/, "") : "/project" }}
        emptyHint={
          cfg
            ? `Start with a plan, like "${cfg.noun === "stag" ? "Stag weekend" : "Hen weekend"}", then split it into accommodation, flights and activities. Suits and outfits can be plans too.`
            : 'Start with a category, like "Catering" or "Venue", then split it into parts (Food, Drink) with options to choose between.'
        }
      />
    </section>
  );
}
