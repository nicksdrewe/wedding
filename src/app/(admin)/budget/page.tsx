import { createClient } from "@/lib/supabase/server";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { getFxRates } from "@/lib/currency/rates";
import { convertToGBP, type Currency } from "@/lib/currency/convert";

export default async function BudgetPage() {
  const supabase = await createClient();
  const [{ data: rows }, rates] = await Promise.all([
    supabase
      .from("category_pages")
      .select("id, title, category_costs(predicted_cost_min, predicted_cost_max, actual_cost, currency)")
      .order("title"),
    getFxRates(),
  ]);

  // Everything here is a cross-category SUM, so every constituent is
  // converted to GBP before being added — the budget page stays GBP-only
  // regardless of what currency any individual category was entered in
  // (unlike a single category's own card, which shows its native currency
  // unconverted since there's nothing to sum there).
  const items = (rows ?? []).map((r) => {
    const cost = Array.isArray(r.category_costs) ? r.category_costs[0] : r.category_costs;
    const currency: Currency = cost?.currency ?? "GBP";
    return {
      title: r.title,
      predictedMin: convertToGBP(Number(cost?.predicted_cost_min ?? 0), currency, rates),
      predictedMax: convertToGBP(Number(cost?.predicted_cost_max ?? 0), currency, rates),
      actual: convertToGBP(Number(cost?.actual_cost ?? 0), currency, rates),
    };
  });

  const totalPredictedMin = items.reduce((sum, i) => sum + i.predictedMin, 0);
  const totalPredictedMax = items.reduce((sum, i) => sum + i.predictedMax, 0);
  const totalActual = items.reduce((sum, i) => sum + i.actual, 0);
  // "Over" means past the top of the predicted range, "under" means below
  // the bottom of it — actual landing inside the range is on track, not a
  // diff worth flagging either way.
  const totalDiff = totalActual > totalPredictedMax ? totalActual - totalPredictedMax : totalActual < totalPredictedMin ? totalActual - totalPredictedMin : 0;
  const overallOver = totalDiff > 0;
  const onTrack = totalDiff === 0;
  const highestPredicted = items.reduce((max, i) => Math.max(max, i.predictedMax, i.actual), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Planning"
        title="Budget Tracker"
        description="Rolls up automatically from the cost fields on every category page — always shown in GBP, converted live from whatever currency each category was entered in."
      />

      {items.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No categories yet"
          hint="Costs entered on category pages show up here."
        />
      ) : (
        <>
          {/* Running total, front and centre — the number people actually
              came here for. */}
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-[10px] border border-ink/10 bg-white px-5 py-4">
              <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                Predicted total
              </p>
              <p className="mt-1.5 font-display text-[26px] tracking-tight tabular-nums">
                £<AnimatedNumber value={totalPredictedMin} springOptions={{ bounce: 0 }} />
                {"–"}£<AnimatedNumber value={totalPredictedMax} springOptions={{ bounce: 0 }} />
              </p>
            </div>
            <div className="rounded-[10px] border border-ink/10 bg-white px-5 py-4">
              <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                Actual total
              </p>
              <p className="mt-1.5 font-display text-[26px] tracking-tight tabular-nums">
                £<AnimatedNumber value={totalActual} springOptions={{ bounce: 0 }} />
              </p>
            </div>
            <div
              className={`rounded-[10px] border px-5 py-4 ${
                onTrack ? "border-accent/25 bg-accent/5" : overallOver ? "border-alert/25 bg-alert/5" : "border-accent/25 bg-accent/5"
              }`}
            >
              <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                {onTrack ? "Within predicted range" : overallOver ? "Over budget by" : "Under budget by"}
              </p>
              <p
                className={`mt-1.5 font-display text-[26px] tracking-tight tabular-nums ${
                  onTrack ? "text-accent" : overallOver ? "text-alert" : "text-accent"
                }`}
              >
                {onTrack ? (
                  "On track"
                ) : (
                  <>
                    £<AnimatedNumber value={Math.abs(totalDiff)} springOptions={{ bounce: 0 }} />
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Per-category breakdown — predicted vs actual read side by side,
              with a bar so the comparison doesn't require doing the maths. */}
          <div className="mt-6 overflow-hidden rounded-[10px] border border-ink/10">
            <table className="w-full min-w-[640px] text-left font-serif text-[13px] tabular-nums">
              <thead className="bg-cream-deep">
                <tr>
                  <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                    Category
                  </th>
                  <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                    Predicted
                  </th>
                  <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                    Actual
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                    Diff
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const diff =
                    i.actual > i.predictedMax ? i.actual - i.predictedMax : i.actual < i.predictedMin ? i.actual - i.predictedMin : 0;
                  const overBudget = diff > 0;
                  const predictedPct = highestPredicted > 0 ? (i.predictedMax / highestPredicted) * 100 : 0;
                  const actualPct = highestPredicted > 0 ? (i.actual / highestPredicted) * 100 : 0;
                  return (
                    <tr
                      key={i.title}
                      className="border-t border-ink/8 transition-colors duration-150 hover:bg-cream-deep/40"
                    >
                      <td className="px-5 py-4 align-top font-semibold">{i.title}</td>
                      <td className="px-5 py-4 align-top">
                        <div>
                          £<AnimatedNumber value={i.predictedMin} springOptions={{ bounce: 0 }} />
                          {"–"}£<AnimatedNumber value={i.predictedMax} springOptions={{ bounce: 0 }} />
                        </div>
                        <div className="mt-1.5 h-1 w-24 rounded-full bg-ink/8">
                          <div
                            className="h-full rounded-full bg-ink-soft/50"
                            style={{ width: `${Math.min(predictedPct, 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div>
                          £<AnimatedNumber value={i.actual} springOptions={{ bounce: 0 }} />
                        </div>
                        <div className="mt-1.5 h-1 w-24 rounded-full bg-ink/8">
                          <div
                            className={`h-full rounded-full ${overBudget ? "bg-alert" : "bg-accent"}`}
                            style={{ width: `${Math.min(actualPct, 100)}%` }}
                          />
                        </div>
                      </td>
                      <td
                        className={`px-5 py-4 text-right align-top font-semibold ${
                          overBudget ? "text-alert" : diff < 0 ? "text-accent" : "text-ink-soft"
                        }`}
                      >
                        {diff === 0 ? (
                          "On track"
                        ) : (
                          <>
                            {overBudget ? "+" : "−"}£
                            <AnimatedNumber value={Math.abs(diff)} springOptions={{ bounce: 0 }} />
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-ink/15 bg-cream-deep/60 font-semibold">
                  <td className="px-5 py-3.5">Total</td>
                  <td className="px-5 py-3.5">
                    £<AnimatedNumber value={totalPredictedMin} springOptions={{ bounce: 0 }} />
                    {"–"}£<AnimatedNumber value={totalPredictedMax} springOptions={{ bounce: 0 }} />
                  </td>
                  <td className="px-5 py-3.5">
                    £<AnimatedNumber value={totalActual} springOptions={{ bounce: 0 }} />
                  </td>
                  <td
                    className={`px-5 py-3.5 text-right ${onTrack ? "text-accent" : overallOver ? "text-alert" : "text-accent"}`}
                  >
                    {onTrack ? (
                      "On track"
                    ) : (
                      <>
                        {overallOver ? "+" : "−"}£
                        <AnimatedNumber value={Math.abs(totalDiff)} springOptions={{ bounce: 0 }} />
                      </>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
