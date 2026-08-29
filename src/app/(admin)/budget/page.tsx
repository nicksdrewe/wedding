import { createClient } from "@/lib/supabase/server";

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
      <h1 className="font-script text-4xl">Budget Tracker</h1>
      <p className="mt-2 font-serif text-ink-soft">
        Rolls up automatically from the cost fields on every category page.
      </p>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-ink/10">
        <table className="w-full text-left font-serif text-sm">
          <thead className="bg-cream-deep">
            <tr>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Predicted</th>
              <th className="px-4 py-3">Actual</th>
              <th className="px-4 py-3">Difference</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.title} className="border-t border-ink/10">
                <td className="px-4 py-3">{i.title}</td>
                <td className="px-4 py-3">£{Number(i.predicted).toFixed(2)}</td>
                <td className="px-4 py-3">£{Number(i.actual).toFixed(2)}</td>
                <td
                  className={`px-4 py-3 ${
                    Number(i.actual) > Number(i.predicted)
                      ? "text-red-700"
                      : "text-ink-soft"
                  }`}
                >
                  £{(Number(i.actual) - Number(i.predicted)).toFixed(2)}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-soft">
                  No categories yet — costs entered on category pages show up
                  here.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-ink/20 font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3">£{totalPredicted.toFixed(2)}</td>
              <td className="px-4 py-3">£{totalActual.toFixed(2)}</td>
              <td className="px-4 py-3">
                £{(totalActual - totalPredicted).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
