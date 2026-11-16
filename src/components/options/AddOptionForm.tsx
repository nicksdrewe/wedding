"use client";

import { useRef, useState, useTransition } from "react";
import type { OptionFields } from "@/lib/options/kinds";
import { addOption } from "@/lib/options/actions";

export function AddOptionForm({
  groupId,
  revalidate,
  showCosts = true,
  fields = { location: true, stay: true },
}: {
  groupId: string;
  revalidate: string;
  // False for someone who can add options but isn't allowed to see prices
  // here (cost_access, 0031_cost_access.sql) — the cost inputs are then left
  // out entirely and addOption doesn't touch the option's costs.
  showCosts?: boolean;
  // Which boxes this kind of option needs (see lib/options/kinds.ts).
  fields?: OptionFields;
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
          const result = await addOption(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          formRef.current?.reset();
        })
      }
      className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-ink/10 bg-cream-deep/30 p-4"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="revalidate" value={revalidate} />
      <input
        name="name"
        required
        placeholder="Option name"
        className="field w-auto"
      />
      {showCosts && (
        <>
      <input type="hidden" name="hasCostFields" value="1" />
      <input
        name="predictedCostMin"
        type="number"
        step="0.01"
        placeholder="Predicted min"
        className="field w-28"
      />
      <input
        name="predictedCostMax"
        type="number"
        step="0.01"
        placeholder="Predicted max"
        className="field w-28"
      />
      <input
        name="actualCost"
        type="number"
        step="0.01"
        placeholder="Actual"
        className="field w-28"
      />
      <select
        name="currency"
        defaultValue="GBP"
        className="field w-auto"
      >
        <option value="GBP">£ GBP</option>
        <option value="EUR">€ EUR</option>
      </select>
        </>
      )}
      <input
        name="optionDate"
        type="date"
        className="field w-auto"
      />
      <input
        name="contactName"
        placeholder="Contact name"
        className="field w-auto"
      />
      <input
        name="contactPhone"
        placeholder="Contact phone"
        className="field w-auto"
      />
      <input
        name="contactEmail"
        type="email"
        placeholder="Contact email"
        className="field w-auto"
      />
      {fields.location && (
        <>
      <input
        name="latitude"
        type="number"
        step="any"
        min={-90}
        max={90}
        placeholder="Latitude"
        className="field w-28"
      />
      <input
        name="longitude"
        type="number"
        step="any"
        min={-180}
        max={180}
        placeholder="Longitude"
        className="field w-28"
      />
        </>
      )}
      {fields.stay && (
        <>
      <input
        name="nights"
        type="number"
        min={0}
        step={1}
        placeholder="Nights"
        className="field w-24"
      />
      <input
        name="sleeps"
        type="number"
        min={0}
        step={1}
        placeholder="Sleeps"
        className="field w-24"
      />
        </>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary"
      >
        {pending ? "Adding…" : "Add option"}
      </button>
      {error && <p className="w-full font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}
