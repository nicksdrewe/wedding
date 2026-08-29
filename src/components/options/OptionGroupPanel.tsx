import { createClient } from "@/lib/supabase/server";
import { AddOptionForm } from "./AddOptionForm";
import { SelectWinnerButton } from "./SelectWinnerButton";

export async function OptionGroupPanel({
  groupId,
  categoryPageId,
  revalidate,
}: {
  groupId: string;
  categoryPageId: string | null;
  revalidate: string;
}) {
  const supabase = await createClient();
  const { data: options } = await supabase
    .from("page_options")
    .select("id, name, predicted_cost, actual_cost, option_date, contact_name, contact_phone, contact_email, is_winner")
    .eq("option_group_id", groupId)
    .order("created_at");

  return (
    <div className="mt-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(options ?? []).map((o) => (
          <div
            key={o.id}
            className={`rounded-2xl border p-4 font-serif text-sm ${
              o.is_winner ? "border-gold bg-cream-deep" : "border-ink/10 bg-cream-deep/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{o.name}</span>
              {o.is_winner && (
                <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs text-gold">
                  Selected
                </span>
              )}
            </div>
            <p className="mt-1 text-ink-soft">
              Predicted £{o.predicted_cost ?? "—"} · Actual £{o.actual_cost ?? "—"}
            </p>
            {o.option_date && <p className="text-ink-soft">{o.option_date}</p>}
            {o.contact_name && (
              <p className="text-ink-soft">
                {o.contact_name}
                {o.contact_phone ? ` · ${o.contact_phone}` : ""}
              </p>
            )}
            {!o.is_winner && (
              <div className="mt-3">
                <SelectWinnerButton
                  groupId={groupId}
                  optionId={o.id}
                  categoryPageId={categoryPageId}
                  revalidate={revalidate}
                />
              </div>
            )}
          </div>
        ))}
        {(!options || options.length === 0) && (
          <p className="font-serif text-sm text-ink-soft">
            No options logged yet — add at least two to compare.
          </p>
        )}
      </div>

      <AddOptionForm groupId={groupId} revalidate={revalidate} />
    </div>
  );
}
