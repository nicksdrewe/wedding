import { formatCostRange, formatCurrency } from "@/lib/currency/format";
import { loadCategoryFeedback } from "@/lib/categories/feedback";
import { sumTotals, type CategoryNode } from "@/lib/categories/tree";
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
  const { total, partial } = sumTotals(roots);
  return (
    <section className="mb-10">
      <div className="section-head">
        <h2 className="section-head__title">Plans</h2>
        <span className="section-head__rule" />
      </div>
      {total && (
        <div className="surface surface-tint mb-2 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div>
              <p className="stat__label">Everything planned so far</p>
              <p className="stat__value">
                {formatCostRange(total.min, total.max, "GBP")}
                {partial && <span className="text-[18px] text-ink-soft"> +</span>}
              </p>
            </div>
            <div className="text-right">
              <p className="stat__label">Spent so far</p>
              <p className="stat__value text-accent">{formatCurrency(total.actual ?? 0, "GBP")}</p>
            </div>
          </div>
          <p className="mt-2 font-reading text-[13px] text-ink-soft">
            Added up from every plan below: a range from the cheapest to the dearest option until you choose one, then the real figure.
          </p>
        </div>
      )}
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
