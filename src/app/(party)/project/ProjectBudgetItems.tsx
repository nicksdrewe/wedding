"use client";

import { useRef, useState, useTransition } from "react";
import { EditableRow } from "@/components/EditableRow";
import { formatCurrency } from "@/lib/currency/format";
import type { Currency } from "@/lib/currency/convert";
import {
  addProjectBudgetItem,
  deleteProjectBudgetItem,
  updateProjectBudgetItem,
} from "@/lib/gendered/budget";

export type ProjectBudgetItem = {
  id: string;
  name: string;
  predicted_cost: number | null;
  actual_cost: number | null;
  currency: Currency;
};

const INPUT =
  "rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors focus:border-accent";

// One form for both adding a line and editing an existing one — same
// convention as ContactForm/DateForm on the category pages.
function BudgetItemForm({
  visibleTag,
  item,
  onCancel,
  onSaved,
}: {
  visibleTag: "groomsman" | "bridesmaid";
  item?: ProjectBudgetItem;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = item ? await updateProjectBudgetItem(formData) : await addProjectBudgetItem(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          if (!item) formRef.current?.reset();
          onSaved?.();
        })
      }
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="visibleTag" value={visibleTag} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <input name="name" required defaultValue={item?.name ?? ""} placeholder="e.g. Flights" className={INPUT} />
      <input
        name="predictedCost"
        type="number"
        step="0.01"
        min={0}
        defaultValue={item?.predicted_cost ?? ""}
        placeholder="Predicted"
        className={`w-28 ${INPUT}`}
      />
      <input
        name="actualCost"
        type="number"
        step="0.01"
        min={0}
        defaultValue={item?.actual_cost ?? ""}
        placeholder="Actual"
        className={`w-28 ${INPUT}`}
      />
      <select name="currency" defaultValue={item?.currency ?? "GBP"} className={INPUT}>
        <option value="GBP">£ GBP</option>
        <option value="EUR">€ EUR</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2 font-serif text-xs text-cream transition hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Saving…" : item ? "Save" : "Add line"}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-ink/20 px-5 py-2 font-serif text-xs text-ink-soft transition hover:border-ink/40"
        >
          Cancel
        </button>
      )}
      {error && <p className="w-full font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}

export function ProjectBudgetItems({
  visibleTag,
  items,
  canManage,
}: {
  visibleTag: "groomsman" | "bridesmaid";
  items: ProjectBudgetItem[];
  // The project's admin (best man / maid of honour) or the couple. Members
  // shown the budget by the couple get it read-only.
  canManage: boolean;
}) {
  return (
    <div>
      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <EditableRow
              key={item.id}
              item={item}
              isCouple={canManage}
              onDelete={deleteProjectBudgetItem}
              confirmMessage={`Remove "${item.name}" from the budget? This can not be undone.`}
              renderView={(i) => (
                <span className="flex flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 font-reading text-[13px] text-ink">
                  <span className="font-serif font-semibold">{i.name}</span>
                  <span className="text-ink-soft tabular-nums">
                    {i.predicted_cost != null ? `${formatCurrency(i.predicted_cost, i.currency)} predicted` : "No estimate"}
                    {i.actual_cost != null ? ` · ${formatCurrency(i.actual_cost, i.currency)} actual` : ""}
                  </span>
                </span>
              )}
              renderForm={({ item: editing, onCancel, onSaved }) => (
                <li className="rounded-[8px] border border-ink/8 bg-cream/50 px-3 py-2">
                  <BudgetItemForm visibleTag={visibleTag} item={editing} onCancel={onCancel} onSaved={onSaved} />
                </li>
              )}
            />
          ))}
        </ul>
      )}
      {canManage && (
        <div className={items.length > 0 ? "mt-3" : ""}>
          <BudgetItemForm visibleTag={visibleTag} />
        </div>
      )}
    </div>
  );
}
