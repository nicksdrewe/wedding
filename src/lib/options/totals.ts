import type { Currency } from "@/lib/currency/convert";

export type CostItem = {
  amount: number;
  kind: "cost" | "income";
};

export type OptionTotals = {
  // Headline: the option's own predicted/actual cost, net of income lines
  // (guest recoup) only — additional cost lines are deliberately NOT
  // folded in here, per the couple's framing of "headline" vs "additional
  // costs, shown as a single sum".
  headlineMin: number | null;
  headlineMax: number | null;
  headlineActual: number | null;
  // The single sum of every "cost" line item (breakfast, wine, staff...).
  additionalSum: number;
  // Everything combined — what actually gets rolled into the category's
  // budget total when this option is picked as the winner.
  totalMin: number | null;
  totalMax: number | null;
  totalActual: number | null;
};

// One shared calculation, used by both the option card display and the
// selectWinner/markOptionWinner budget rollup — the two must never drift
// apart, or the number on the card would stop matching what actually
// lands on the Budget page.
export function computeOptionTotals(
  option: { predicted_cost_min: number | null; predicted_cost_max: number | null; actual_cost: number | null },
  costItems: CostItem[]
): OptionTotals {
  const costSum = costItems.filter((i) => i.kind === "cost").reduce((sum, i) => sum + i.amount, 0);
  const incomeSum = costItems.filter((i) => i.kind === "income").reduce((sum, i) => sum + i.amount, 0);
  const netAddons = costSum - incomeSum;

  const headlineMin = option.predicted_cost_min != null ? option.predicted_cost_min - incomeSum : null;
  const headlineMax = option.predicted_cost_max != null ? option.predicted_cost_max - incomeSum : null;
  const headlineActual = option.actual_cost != null ? option.actual_cost - incomeSum : null;

  return {
    headlineMin,
    headlineMax,
    headlineActual,
    additionalSum: costSum,
    totalMin: option.predicted_cost_min != null ? option.predicted_cost_min + netAddons : null,
    totalMax: option.predicted_cost_max != null ? option.predicted_cost_max + netAddons : null,
    totalActual: option.actual_cost != null ? option.actual_cost + netAddons : null,
  };
}

export type { Currency };
