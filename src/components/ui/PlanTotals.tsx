import { formatCostRange, formatCurrency } from "@/lib/currency/format";
import { sumTotals, type CategoryNode } from "@/lib/categories/tree";

// Everything planned so far (a range, then real figures as winners are
// chosen) with what has been spent so far on the right.
export function PlanTotals({ roots }: { roots: CategoryNode[] }) {
  const { total, partial } = sumTotals(roots);
  return (
    <>
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
    </>
  );
}
