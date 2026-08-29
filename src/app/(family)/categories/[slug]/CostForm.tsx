"use client";

import { useTransition } from "react";
import { updateCategoryCost } from "../actions";

export function CostForm({
  categoryPageId,
  predictedCost,
  actualCost,
}: {
  categoryPageId: string;
  predictedCost: number | string;
  actualCost: number | string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => startTransition(() => updateCategoryCost(formData))}
      className="mt-2 flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="categoryPageId" value={categoryPageId} />
      <div className="flex flex-col">
        <label className="text-xs text-ink-soft">Predicted (£)</label>
        <input
          name="predictedCost"
          type="number"
          step="0.01"
          defaultValue={predictedCost}
          className="w-32 rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-ink"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-ink-soft">Actual (£)</label>
        <input
          name="actualCost"
          type="number"
          step="0.01"
          defaultValue={actualCost}
          className="w-32 rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-ink"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2 text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
