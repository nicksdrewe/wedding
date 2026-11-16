"use client";

import { useState, useTransition } from "react";
import { updateCategoryCost } from "../actions";

export function CostForm({
  categoryPageId,
  predictedCostMin,
  predictedCostMax,
  actualCost,
  currency,
}: {
  categoryPageId: string;
  predictedCostMin: number | string;
  predictedCostMax: number | string;
  actualCost: number | string;
  currency: "GBP" | "EUR";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await updateCategoryCost(formData);
          if (result?.error) setError(result.error);
        })
      }
      className="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="categoryPageId" value={categoryPageId} />
      <div className="flex flex-col gap-1">
        <label className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
          Predicted min
        </label>
        <input
          name="predictedCostMin"
          type="number"
          step="0.01"
          defaultValue={predictedCostMin}
          className="field w-28"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
          Predicted max
        </label>
        <input
          name="predictedCostMax"
          type="number"
          step="0.01"
          defaultValue={predictedCostMax}
          className="field w-28"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
          Actual
        </label>
        <input
          name="actualCost"
          type="number"
          step="0.01"
          defaultValue={actualCost}
          className="field w-28"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
          Currency
        </label>
        <select
          name="currency"
          defaultValue={currency}
          className="field w-auto"
        >
          <option value="GBP">£ GBP</option>
          <option value="EUR">€ EUR</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {error && <p className="w-full font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}
