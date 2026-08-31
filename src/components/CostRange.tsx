import { formatCostRange, formatCurrency } from "@/lib/currency/format";
import type { Currency } from "@/lib/currency/convert";

// Shared predicted-range + actual-cost display, so every card/table cell
// formats a cost the same way instead of each call site hand-building its
// own "£X–£Y" string. Native currency only — this never converts to GBP;
// callers that need a GBP-converted aggregate (budget totals) convert
// server-side first and pass the already-converted numbers in as GBP.
export function CostRange({
  predictedMin,
  predictedMax,
  actual,
  currency = "GBP",
  className,
}: {
  predictedMin: number | null;
  predictedMax: number | null;
  actual: number | null;
  currency?: Currency;
  className?: string;
}) {
  const predicted = formatCostRange(predictedMin, predictedMax, currency);
  return (
    <span className={className}>
      {predicted} predicted
      {actual != null ? ` · ${formatCurrency(actual, currency)} actual` : ""}
    </span>
  );
}
