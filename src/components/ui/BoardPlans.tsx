import { PlanTotals } from "./PlanTotals";
import { loadCategoryFeedback } from "@/lib/categories/feedback";
import type { CategoryNode } from "@/lib/categories/tree";
import { BOARDS, type BoardKey } from "@/lib/categories/boards";
import { CategoriesView } from "@/app/(family)/categories/CategoriesView";

// The stag / hen planning area on a board's page: every plan (stag weekend,
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
}: {
  board: BoardKey;
  roots: CategoryNode[];
  isAdmin: boolean;
  profileId: string | null;
  canInteract: boolean;
}) {
  const cfg = BOARDS[board];
  const feedback = await loadCategoryFeedback(roots, profileId);
  return (
    <section className="mb-10">
      <div className="section-head">
        <h2 className="section-head__title">Plans</h2>
        <span className="section-head__rule" />
      </div>
      <PlanTotals roots={roots} />
      <CategoriesView
        roots={roots}
        canManage={isAdmin}
        basePath={cfg.plansPath}
        board={board}
        feedback={feedback}
        interact={{ canInteract, canModerate: isAdmin, revalidate: cfg.plansPath.replace(/\/plans$/, "") }}
        emptyHint={`Start with a plan, like "${cfg.noun === "stag" ? "Stag weekend" : "Hen weekend"}", then split it into accommodation, flights and activities. Suits and outfits can be plans too.`}
      />
    </section>
  );
}
