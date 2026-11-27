"use client";

import { useRef, useState, useTransition } from "react";
import { LocationInput } from "@/components/LocationInput";
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
      <LocationInput className="w-full sm:w-96" />
        </>
      )}
      {fields.stay && (
        <>
      <label className="flex flex-col gap-1">
        <span className="field-label !mb-0">Nights</span>
        <input
          name="nights"
        type="number"
        min={0}
        step={1}
        className="field w-24"
          placeholder="0"
          title="How many nights"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="field-label !mb-0">Sleeps</span>
        <input
          name="sleeps"
        type="number"
        min={0}
        step={1}
        className="field w-24"
          placeholder="0"
          title="How many people it sleeps"
        />
      </label>
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
