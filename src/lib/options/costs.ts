import type { Currency } from "@/lib/currency/convert";

// An option's prices live in page_option_costs, not on page_options itself
// (see 0031_cost_access.sql) — a separate table so RLS can show someone a
// venue without showing what it costs. Every page_options select that wants
// prices embeds this fragment and passes the row through readOptionCosts.
export const OPTION_COSTS_EMBED =
  "page_option_costs(predicted_cost_min, predicted_cost_max, actual_cost, currency)";

export type OptionCostFields = {
  predicted_cost_min: number | null;
  predicted_cost_max: number | null;
  actual_cost: number | null;
  currency: Currency;
  // True when the viewer isn't allowed to see this option's prices. Every
  // option always HAS a cost row (created by trigger), so the embed coming
  // back empty can only mean RLS withheld it — never "nothing entered yet".
  // UI must hide cost display and cost inputs entirely when this is set,
  // rather than rendering the nulls as "no cost".
  costs_hidden: boolean;
};

type CostEmbed = {
  predicted_cost_min: number | null;
  predicted_cost_max: number | null;
  actual_cost: number | null;
  currency: Currency | null;
};

export function readOptionCosts(row: { page_option_costs?: unknown }): OptionCostFields {
  // PostgREST returns a to-one embed as an object, but tolerate the array
  // shape too so this never depends on how the relationship was inferred.
  const raw = row.page_option_costs;
  const embed = (Array.isArray(raw) ? raw[0] : raw) as CostEmbed | null | undefined;

  if (!embed) {
    return {
      predicted_cost_min: null,
      predicted_cost_max: null,
      actual_cost: null,
      currency: "GBP",
      costs_hidden: true,
    };
  }

  return {
    predicted_cost_min: embed.predicted_cost_min,
    predicted_cost_max: embed.predicted_cost_max,
    actual_cost: embed.actual_cost,
    currency: embed.currency ?? "GBP",
    costs_hidden: false,
  };
}
