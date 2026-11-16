import { createClient } from "@/lib/supabase/server";
import { getFxRates } from "@/lib/currency/rates";
import { convertToGBP, type Currency } from "@/lib/currency/convert";
import { formatCostRange, formatCurrency } from "@/lib/currency/format";
import { ProjectBudgetItems, type ProjectBudgetItem } from "./ProjectBudgetItems";

// The winning option of each comparison on this board, with its price —
// passed in by the page, which already fetched them (and already had any
// hidden prices withheld by RLS).
export type ChosenOption = {
  id: string;
  name: string;
  comparison: string;
  predicted_cost_min: number | null;
  predicted_cost_max: number | null;
  actual_cost: number | null;
  currency: Currency;
};

// A stag/hen project's own budget: what's been chosen in its comparisons,
// plus free-standing lines the admin adds (0034_project_admins_and_budgets
// .sql). Entirely separate from the wedding Budget page, which never reads
// any of this. Only rendered by the page for someone allowed to see this
// project's money; RLS independently returns nothing to anyone else.
export async function ProjectBudget({
  visibleTag,
  chosen,
  canManage,
}: {
  visibleTag: "groomsman" | "bridesmaid";
  chosen: ChosenOption[];
  canManage: boolean;
}) {
  const supabase = await createClient();
  const [{ data }, rates] = await Promise.all([
    supabase
      .from("project_budget_items")
      .select("id, name, predicted_cost, actual_cost, currency")
      .eq("visible_tag", visibleTag)
      .order("created_at"),
    getFxRates(),
  ]);
  const items: ProjectBudgetItem[] = data ?? [];

  // Totals are a sum across lines that may be in different currencies, so
  // everything is converted to GBP first — same rule as the wedding Budget.
  const gbp = (amount: number | null, currency: Currency) =>
    amount == null ? 0 : convertToGBP(Number(amount), currency, rates);

  let predictedMin = 0;
  let predictedMax = 0;
  let actual = 0;
  for (const i of items) {
    predictedMin += gbp(i.predicted_cost, i.currency);
    predictedMax += gbp(i.predicted_cost, i.currency);
    actual += gbp(i.actual_cost, i.currency);
  }
  for (const c of chosen) {
    // An option with only one end of its range entered counts that figure
    // for both ends rather than as zero.
    predictedMin += gbp(c.predicted_cost_min ?? c.predicted_cost_max, c.currency);
    predictedMax += gbp(c.predicted_cost_max ?? c.predicted_cost_min, c.currency);
    actual += gbp(c.actual_cost, c.currency);
  }

  const empty = items.length === 0 && chosen.length === 0;

  return (
    <section className="mt-12">
      <div className="section-head"><h2 className="section-head__title">Budget</h2><span className="section-head__rule" /></div>
      <p className="mt-2 font-reading text-sm text-ink-soft italic">
        This project&rsquo;s own money — separate from the wedding budget.
        {canManage ? "" : " Shared with you to view."}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="surface px-5 py-4">
          <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Predicted total</p>
          <p className="mt-1.5 font-display text-[24px] tracking-tight tabular-nums">
            {empty ? "—" : formatCostRange(predictedMin, predictedMax, "GBP")}
          </p>
        </div>
        <div className="surface px-5 py-4">
          <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Spent so far</p>
          <p className="mt-1.5 font-display text-[24px] tracking-tight tabular-nums">
            {empty ? "—" : formatCurrency(actual, "GBP")}
          </p>
        </div>
      </div>

      {chosen.length > 0 && (
        <div className="mt-5">
          <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft/70 uppercase">
            Chosen in comparisons
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {chosen.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 rounded-[8px] border border-ink/8 bg-cream/50 px-3 py-2 font-reading text-[13px]"
              >
                <span>
                  <span className="font-serif font-semibold text-ink">{c.name}</span>
                  <span className="text-ink-soft"> — {c.comparison}</span>
                </span>
                <span className="text-ink-soft tabular-nums">
                  {formatCostRange(c.predicted_cost_min, c.predicted_cost_max, c.currency)} predicted
                  {c.actual_cost != null ? ` · ${formatCurrency(c.actual_cost, c.currency)} actual` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft/70 uppercase">
          Other costs
        </p>
        <div className="mt-2">
          {items.length === 0 && !canManage ? (
            <p className="font-reading text-[13px] text-ink-soft">Nothing added yet.</p>
          ) : (
            <ProjectBudgetItems visibleTag={visibleTag} items={items} canManage={canManage} />
          )}
        </div>
      </div>
    </section>
  );
}
