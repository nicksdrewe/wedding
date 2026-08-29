import { AnimatedHeading } from "@/components/AnimatedHeading";
import { createClient } from "@/lib/supabase/server";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";

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
      predicted: cost?.predicted_cost ?? 0,
      actual: cost?.actual_cost ?? 0,
    };
  });

  const totalPredicted = items.reduce((sum, i) => sum + Number(i.predicted), 0);
  const totalActual = items.reduce((sum, i) => sum + Number(i.actual), 0);

  return (
    <div>
      <AnimatedHeading className="font-display text-[34px] tracking-tight">Budget Tracker</AnimatedHeading>
      <p className="mt-2 font-reading text-[15px] text-ink-soft">
        Rolls up automatically from the cost fields on every category page.
      </p>

      <div className="mt-8 overflow-x-auto rounded-[8px] border border-ink/10">
        <table className="w-full min-w-[520px] text-left font-serif text-[13px] tabular-nums">
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
              <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                Diff
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const diff = Number(i.actual) - Number(i.predicted);
              const overBudget = diff > 0;
              return (
                <tr key={i.title} className="border-t border-ink/8">
                  <td className="px-5 py-3.5">{i.title}</td>
                  <td className="px-5 py-3.5">£{Number(i.predicted).toFixed(2)}</td>
                  <td className="px-5 py-3.5">£{Number(i.actual).toFixed(2)}</td>
                  <td className={`px-5 py-3.5 ${overBudget ? "text-alert" : "text-accent"}`}>
                    {overBudget ? "+" : "−"}£{Math.abs(diff).toFixed(2)}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center font-reading text-ink-soft">
                  No categories yet — costs entered on category pages show up
                  here.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-ink/15 font-semibold">
              <td className="px-5 py-3.5">Total</td>
              <td className="px-5 py-3.5">
                £<AnimatedNumber value={totalPredicted} springOptions={{ bounce: 0 }} />
              </td>
              <td className="px-5 py-3.5">
                £<AnimatedNumber value={totalActual} springOptions={{ bounce: 0 }} />
              </td>
              <td className={`px-5 py-3.5 ${totalActual > totalPredicted ? "text-alert" : "text-accent"}`}>
                {totalActual > totalPredicted ? "+" : "−"}£
                <AnimatedNumber
                  value={Math.abs(totalActual - totalPredicted)}
                  springOptions={{ bounce: 0 }}
                />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
