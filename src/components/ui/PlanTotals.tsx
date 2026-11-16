import Link from "next/link";
import { ArrowUpRight, Receipt } from "lucide-react";
import { formatCostRange, formatCurrency } from "@/lib/currency/format";
import { flattenTree, sumTotals, type CategoryNode } from "@/lib/categories/tree";

// Everything planned so far (a range, then real figures as winners are
// chosen) with what has been spent so far on the right. With expensesHref, a
// button on the far right (about a fifth of the row) goes through to splitting
// and settling expenses.
export function PlanTotals({ roots, expensesHref }: { roots: CategoryNode[]; expensesHref?: string }) {
  const { total: seen, partial } = sumTotals(roots);
  // Plans the best man / maid of honour has hidden: we show a blurred figure
  // that is NOT the real amount, only that something is left out.
  const hiddenCount = flattenTree(roots).filter((n) => n.hiddenFromMe).length;
  const total = seen ?? (hiddenCount > 0 ? { min: 0, max: 0, actual: 0 } : null);
  if (!total && !expensesHref) return null;
  const excluding = hiddenCount > 0 && (
    <span className="ml-1.5 font-reading text-[12px] font-normal text-ink-soft">
      (excluding <span className="inline-block select-none blur-[5px]" aria-hidden="true">£8,888</span>
      <span className="sr-only">hidden amounts</span>)
    </span>
  );
  return (
    <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
      {total && (
        <div className="surface surface-tint p-5 sm:w-[75%] sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div>
              <p className="stat__label">Everything planned so far</p>
              <p className="stat__value">
                {formatCostRange(total.min, total.max, "GBP")}
                {partial && <span className="text-[18px] text-ink-soft"> +</span>}
              </p>
              {excluding && <p>{excluding}</p>}
            </div>
            <div className="text-right">
              <p className="stat__label">Spent so far</p>
              <p className="stat__value text-accent">{formatCurrency(total.actual ?? 0, "GBP")}</p>
              {excluding && <p>{excluding}</p>}
            </div>
          </div>
          <p className="mt-2 font-reading text-[13px] text-ink-soft">
            Added up from every plan below: a range from the cheapest to the dearest option until you choose one, then the real figure.
          </p>
        </div>
      )}
      {expensesHref && (
        <Link
          href={expensesHref}
          className="surface surface-raised surface-lift group flex flex-row items-center justify-between gap-3 p-5 sm:ml-auto sm:w-[20%] sm:flex-col sm:items-start sm:justify-between"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sec/10 text-sec transition-colors group-hover:bg-sec group-hover:text-white">
            <Receipt className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="flex-1 sm:flex-none">
            <span className="block font-title text-[20px] leading-tight text-ink">Expenses</span>
            <span className="block font-reading text-[12px] text-ink-soft">Split costs and settle up</span>
          </span>
          <ArrowUpRight className="h-4 w-4 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:self-end" strokeWidth={2} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
