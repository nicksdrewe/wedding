import { redirect } from "next/navigation";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import Link from "next/link";
import { loadCategoryTree } from "@/lib/categories/load";
import { flattenTree } from "@/lib/categories/tree";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getEffectivePermission } from "@/lib/permissions/actions";

export default async function BudgetPage() {
  // The (admin) layout already restricts this route to couple by role —
  // this adds the same fine-grained page_access override every other
  // registered page respects, in case a future permission ever needs to
  // narrow it further than the route-group guard already does.
  const profile = await getCurrentProfile();
  const permission = await getEffectivePermission("budget", profile);
  if (!permission.pageAccess) redirect("/no-access");

  // Every figure here is worked out, not typed: each category's cost comes
  // from its options and everything nested inside it (lib/categories), already
  // converted to pounds so it can be added up. The totals count each
  // top-level category once (it already includes what's inside it).
  // A category whose prices are hidden from this viewer (cost_access,
  // 0031_cost_access.sql) is left out of the table AND the totals.
  const { roots } = await loadCategoryTree(profile);
  const all = flattenTree(roots);
  const hiddenCount = all.filter((n) => !n.costAccess).length;

  const items = all
    .filter((n) => n.costAccess)
    .map((n) => ({
      id: n.id,
      slug: n.slug,
      title: n.title,
      depth: n.depth,
      isParent: n.children.length > 0,
      predictedMin: n.total?.min ?? 0,
      predictedMax: n.total?.max ?? 0,
      actual: n.total?.actual ?? 0,
    }));

  const top = roots.filter((n) => n.costAccess);
  const totalPredictedMin = top.reduce((sum, n) => sum + (n.total?.min ?? 0), 0);
  const totalPredictedMax = top.reduce((sum, n) => sum + (n.total?.max ?? 0), 0);
  const totalActual = top.reduce((sum, n) => sum + (n.total?.actual ?? 0), 0);
  // "Over" means actual spend has passed the top of the predicted range.
  // Being under it is normal while things are still being paid for, so only
  // overspend is flagged.
  const totalDiff = totalActual > totalPredictedMax ? totalActual - totalPredictedMax : 0;
  const overallOver = totalDiff > 0;
  const onTrack = totalDiff === 0;
  const highestPredicted = items.reduce((max, i) => Math.max(max, i.predictedMax, i.actual), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Planning"
        title="Budget Tracker"
        infoText="Worked out from the options in every category: a range until a winner is chosen, then the real figures. A category adds up everything inside it. Always in pounds."
      />

      {hiddenCount > 0 && (
        <p className="surface mt-6 bg-cream-deep/40 px-5 py-3 font-reading text-[13px] text-ink-soft">
          {hiddenCount === 1 ? "1 category isn't" : `${hiddenCount} categories aren't`} included here — the
          totals below cover only the categories shared with your account.
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No categories yet"
          hint="Costs from options on category pages show up here."
        />
      ) : (
        <>
          {/* Running total, front and centre — the number people actually
              came here for. */}
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="surface px-5 py-4">
              <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                Predicted total
              </p>
              <p className="mt-1.5 font-title text-[30px] tracking-tight tabular-nums">
                £<AnimatedNumber value={totalPredictedMin} springOptions={{ bounce: 0 }} />
                {"–"}£<AnimatedNumber value={totalPredictedMax} springOptions={{ bounce: 0 }} />
              </p>
            </div>
            <div className="surface px-5 py-4">
              <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                Actual total
              </p>
              <p className="mt-1.5 font-title text-[30px] tracking-tight tabular-nums">
                £<AnimatedNumber value={totalActual} springOptions={{ bounce: 0 }} />
              </p>
            </div>
            <div
              className={`surface px-5 py-4 ${
                overallOver && !onTrack ? "!border-alert/30 !bg-alert/5" : "surface-tint"
              }`}
            >
              <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                {onTrack ? "Within predicted range" : overallOver ? "Over budget by" : "Under budget by"}
              </p>
              <p
                className={`mt-1.5 font-title text-[30px] tracking-tight tabular-nums ${
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
          <div className="surface mt-6 overflow-hidden">
            <table className="w-full min-w-[640px] text-left font-serif text-[13px] tabular-nums">
              <thead className="bg-sec-tint/70">
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
                  const diff = i.actual > i.predictedMax ? i.actual - i.predictedMax : 0;
                  const overBudget = diff > 0;
                  const predictedPct = highestPredicted > 0 ? (i.predictedMax / highestPredicted) * 100 : 0;
                  const actualPct = highestPredicted > 0 ? (i.actual / highestPredicted) * 100 : 0;
                  return (
                    <tr
                      key={i.id}
                      className="border-t border-ink/8 transition-colors duration-150 hover:bg-cream-deep/40"
                    >
                      <td className={`px-5 py-4 align-top ${i.depth === 0 ? "font-semibold" : "text-ink-soft"}`}>
                        <Link
                          href={`/categories/${i.slug}`}
                          className="inline-flex min-h-8 items-center hover:text-sec"
                          style={{ paddingLeft: `${i.depth * 18}px` }}
                        >
                          {i.depth > 0 && <span aria-hidden="true" className="mr-1.5 text-ink-soft/50">└</span>}
                          {i.title}
                        </Link>
                      </td>
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
