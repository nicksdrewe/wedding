import { createClient } from "@/lib/supabase/server";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default async function BudgetPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("category_pages")
    .select("id, title, category_costs(predicted_cost, actual_cost)")
    .order("title");

  const items = (rows ?? []).map((r) => {
    const cost = Array.isArray(r.category_costs)
      ? r.category_costs[0]
      : r.category_costs;
    return {
      title: r.title,
      predicted: Number(cost?.predicted_cost ?? 0),
      actual: Number(cost?.actual_cost ?? 0),
    };
  });

  const totalPredicted = items.reduce((sum, i) => sum + i.predicted, 0);
  const totalActual = items.reduce((sum, i) => sum + i.actual, 0);
  const totalDiff = totalActual - totalPredicted;
  const overallOver = totalDiff > 0;
  const highestPredicted = items.reduce((max, i) => Math.max(max, i.predicted, i.actual), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Planning"
        title="Budget Tracker"
        description="Rolls up automatically from the cost fields on every category page."
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
                £<AnimatedNumber value={totalPredicted} springOptions={{ bounce: 0 }} />
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
                overallOver ? "border-alert/25 bg-alert/5" : "border-accent/25 bg-accent/5"
              }`}
            >
              <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                {overallOver ? "Over budget by" : "Under budget by"}
              </p>
              <p
                className={`mt-1.5 font-display text-[26px] tracking-tight tabular-nums ${
                  overallOver ? "text-alert" : "text-accent"
                }`}
              >
                £<AnimatedNumber value={Math.abs(totalDiff)} springOptions={{ bounce: 0 }} />
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
                  const diff = i.actual - i.predicted;
                  const overBudget = diff > 0;
                  const predictedPct = highestPredicted > 0 ? (i.predicted / highestPredicted) * 100 : 0;
                  const actualPct = highestPredicted > 0 ? (i.actual / highestPredicted) * 100 : 0;
                  return (
                    <tr
                      key={i.title}
                      className="border-t border-ink/8 transition-colors duration-150 hover:bg-cream-deep/40"
                    >
                      <td className="px-5 py-4 align-top font-semibold">{i.title}</td>
                      <td className="px-5 py-4 align-top">
                        <div>£{i.predicted.toFixed(2)}</div>
                        <div className="mt-1.5 h-1 w-24 rounded-full bg-ink/8">
                          <div
                            className="h-full rounded-full bg-ink-soft/50"
                            style={{ width: `${Math.min(predictedPct, 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div>£{i.actual.toFixed(2)}</div>
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
                        {diff === 0 ? "—" : `${overBudget ? "+" : "−"}£${Math.abs(diff).toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-ink/15 bg-cream-deep/60 font-semibold">
                  <td className="px-5 py-3.5">Total</td>
                  <td className="px-5 py-3.5">
                    £<AnimatedNumber value={totalPredicted} springOptions={{ bounce: 0 }} />
                  </td>
                  <td className="px-5 py-3.5">
                    £<AnimatedNumber value={totalActual} springOptions={{ bounce: 0 }} />
                  </td>
                  <td
                    className={`px-5 py-3.5 text-right ${overallOver ? "text-alert" : "text-accent"}`}
                  >
                    {overallOver ? "+" : "−"}£
                    <AnimatedNumber value={Math.abs(totalDiff)} springOptions={{ bounce: 0 }} />
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
