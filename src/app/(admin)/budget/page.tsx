import { redirect } from "next/navigation";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import Link from "next/link";
import { loadCategoryTree } from "@/lib/categories/load";
import { flattenTree } from "@/lib/categories/tree";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getEffectivePermission } from "@/lib/permissions/actions";
import { getCurrentWedding } from "@/lib/wedding/current";
import { createClient } from "@/lib/supabase/server";
import { BudgetInput } from "./BudgetInput";

// How a spend compares with a budget the couple typed in. No budget, no
// verdict: the predicted range comes from the same option prices as the
// spend, so judging one against the other would always say "fine".
type Verdict =
  | { kind: "none" }
  | { kind: "over"; by: number }
  | { kind: "risk"; by: number }
  | { kind: "ok"; left: number };

function verdict(budget: number | null, actual: number, predictedMax: number): Verdict {
  if (budget == null) return { kind: "none" };
  if (actual > budget) return { kind: "over", by: actual - budget };
  if (predictedMax > budget) return { kind: "risk", by: predictedMax - budget };
  return { kind: "ok", left: budget - actual };
}

const money = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

export default async function BudgetPage() {
  const profile = await getCurrentProfile();
  const permission = await getEffectivePermission("budget", profile);
  if (!permission.pageAccess) redirect("/no-access");
  const isCouple = profile?.role === "couple";

  // Spend and predictions are worked out from the options in every category
  // (lib/categories), in pounds. Budgets are typed in by the couple (0064).
  const { roots } = await loadCategoryTree(profile);
  const all = flattenTree(roots);
  const hiddenCount = all.filter((n) => !n.costAccess).length;

  const wedding = await getCurrentWedding();
  const weddingBudget = (wedding as { budget_total?: number | string | null } | null)?.budget_total;
  const overallBudget = weddingBudget == null ? null : Number(weddingBudget);

  const supabase = await createClient();
  const { data: costRows } = await supabase.from("category_costs").select("*");
  const budgetByCategory = new Map<string, number>();
  for (const r of (costRows ?? []) as { category_page_id: string; budget?: number | string | null }[]) {
    if (r.budget != null) budgetByCategory.set(r.category_page_id, Number(r.budget));
  }

  const items = all
    .filter((n) => n.costAccess)
    .map((n) => ({
      id: n.id,
      slug: n.slug,
      title: n.title,
      depth: n.depth,
      predictedMin: n.total?.min ?? 0,
      predictedMax: n.total?.max ?? 0,
      actual: n.total?.actual ?? 0,
      budget: budgetByCategory.get(n.id) ?? null,
    }));

  const top = roots.filter((n) => n.costAccess);
  const totalPredictedMin = top.reduce((sum, n) => sum + (n.total?.min ?? 0), 0);
  const totalPredictedMax = top.reduce((sum, n) => sum + (n.total?.max ?? 0), 0);
  const totalActual = top.reduce((sum, n) => sum + (n.total?.actual ?? 0), 0);
  const overall = verdict(overallBudget, totalActual, totalPredictedMax);

  const overallTone =
    overall.kind === "over" ? "!border-alert/30 !bg-alert/5" : overall.kind === "risk" ? "!border-[#86641a]/30 !bg-[#86641a]/5" : "surface-tint";

  return (
    <div>
      <PageHeader
        eyebrow="Planning"
        title="Budget Tracker"
        infoText="Set your own budget, for the whole wedding and for any category. Spending is worked out from the options you've chosen; the predicted range covers choices still to be made."
      />

      {hiddenCount > 0 && (
        <p className="surface mt-6 bg-cream-deep/40 px-5 py-3 font-reading text-[13px] text-ink-soft">
          {hiddenCount === 1 ? "1 category isn't" : `${hiddenCount} categories aren't`} included here. The totals below
          cover only the categories shared with your account.
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="surface px-5 py-4">
          <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Your budget</p>
          <div className="mt-1.5">
            {isCouple ? (
              <BudgetInput categoryId={null} value={overallBudget} big placeholder="0" />
            ) : (
              <p className="font-title text-[30px] tracking-tight tabular-nums">{overallBudget == null ? "Not set" : money(overallBudget)}</p>
            )}
          </div>
          <p className="mt-1 font-serif text-[12px] text-ink-soft">What you&rsquo;re planning to spend in total.</p>
        </div>
        <div className="surface px-5 py-4">
          <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Committed so far</p>
          <p className="mt-1.5 font-title text-[30px] tracking-tight tabular-nums">
            £<AnimatedNumber value={totalActual} springOptions={{ bounce: 0 }} />
          </p>
          <p className="mt-1 font-serif text-[12px] text-ink-soft">From the options you&rsquo;ve chosen.</p>
        </div>
        <div className="surface px-5 py-4">
          <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Predicted total</p>
          <p className="mt-1.5 font-title text-[30px] tracking-tight tabular-nums">
            £<AnimatedNumber value={totalPredictedMin} springOptions={{ bounce: 0 }} />
            {"–"}£<AnimatedNumber value={totalPredictedMax} springOptions={{ bounce: 0 }} />
          </p>
          <p className="mt-1 font-serif text-[12px] text-ink-soft">If the open choices land where expected.</p>
        </div>
        <div className={`surface px-5 py-4 ${overallTone}`}>
          <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Against your budget</p>
          {overall.kind === "none" && (
            <p className="mt-2 font-reading text-[15px] text-ink-soft">
              {isCouple ? "Set your budget to see whether you're on track." : "The couple hasn't set a budget yet."}
            </p>
          )}
          {overall.kind === "over" && (
            <>
              <p className="mt-1.5 font-title text-[30px] tracking-tight text-alert tabular-nums">{money(overall.by)} over</p>
              <p className="mt-1 font-serif text-[12px] text-ink-soft">Committed spend is past your budget.</p>
            </>
          )}
          {overall.kind === "risk" && (
            <>
              <p className="mt-1.5 font-title text-[30px] tracking-tight text-[#86641a] tabular-nums">Could go over</p>
              <p className="mt-1 font-serif text-[12px] text-ink-soft">By up to {money(overall.by)} if the open choices come in high.</p>
            </>
          )}
          {overall.kind === "ok" && (
            <>
              <p className="mt-1.5 font-title text-[30px] tracking-tight text-accent tabular-nums">On track</p>
              <p className="mt-1 font-serif text-[12px] text-ink-soft">{money(overall.left)} of your budget not yet committed.</p>
            </>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState className="mt-8" title="No categories yet" hint="Costs from options on category pages show up here." />
      ) : (
        <div className="surface mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left font-serif text-[13px] tabular-nums">
            <thead className="bg-sec-tint/70">
              <tr>
                {["Category", "Budget", "Predicted", "Committed", "Against budget"].map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase ${i === 4 ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const v = verdict(i.budget, i.actual, i.predictedMax);
                const scale = Math.max(i.budget ?? 0, i.predictedMax, i.actual, 1);
                return (
                  <tr key={i.id} className="border-t border-ink/8 transition-colors duration-150 hover:bg-cream-deep/40">
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
                    <td className="px-5 py-3 align-top">
                      {isCouple ? (
                        <BudgetInput categoryId={i.id} value={i.budget} placeholder="Set" />
                      ) : (
                        <span className="text-ink-soft">{i.budget == null ? "—" : money(i.budget)}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top">
                      {money(i.predictedMin)}–{money(i.predictedMax)}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div>{money(i.actual)}</div>
                      <div className="relative mt-1.5 h-1 w-24 rounded-full bg-ink/8">
                        <div
                          className={`h-full rounded-full ${v.kind === "over" ? "bg-alert" : "bg-accent"}`}
                          style={{ width: `${Math.min((i.actual / scale) * 100, 100)}%` }}
                        />
                        {i.budget != null && (
                          <span
                            aria-hidden="true"
                            className="absolute -top-1 h-3 w-[2px] rounded bg-ink/60"
                            style={{ left: `${Math.min((i.budget / scale) * 100, 100)}%` }}
                          />
                        )}
                      </div>
                    </td>
                    <td
                      className={`px-5 py-4 text-right align-top font-semibold ${
                        v.kind === "over" ? "text-alert" : v.kind === "risk" ? "text-[#86641a]" : v.kind === "ok" ? "text-accent" : "font-normal text-ink-soft/60"
                      }`}
                    >
                      {v.kind === "none" && "No budget set"}
                      {v.kind === "over" && `${money(v.by)} over`}
                      {v.kind === "risk" && `Could go ${money(v.by)} over`}
                      {v.kind === "ok" && `${money(v.left)} left`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-ink/15 bg-cream-deep/60 font-semibold">
                <td className="px-5 py-3.5">Total</td>
                <td className="px-5 py-3.5">{overallBudget == null ? "—" : money(overallBudget)}</td>
                <td className="px-5 py-3.5">
                  {money(totalPredictedMin)}–{money(totalPredictedMax)}
                </td>
                <td className="px-5 py-3.5">{money(totalActual)}</td>
                <td
                  className={`px-5 py-3.5 text-right ${
                    overall.kind === "over" ? "text-alert" : overall.kind === "risk" ? "text-[#86641a]" : overall.kind === "ok" ? "text-accent" : "font-normal text-ink-soft/60"
                  }`}
                >
                  {overall.kind === "none" && "No budget set"}
                  {overall.kind === "over" && `${money(overall.by)} over`}
                  {overall.kind === "risk" && `Could go ${money(overall.by)} over`}
                  {overall.kind === "ok" && `${money(overall.left)} left`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
