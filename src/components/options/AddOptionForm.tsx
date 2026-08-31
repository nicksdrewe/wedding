"use client";

import { useRef, useState, useTransition } from "react";
import { addOption } from "@/lib/options/actions";

export function AddOptionForm({
  groupId,
  revalidate,
}: {
  groupId: string;
  revalidate: string;
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
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <input
        name="predictedCostMin"
        type="number"
        step="0.01"
        placeholder="Predicted min"
        className="w-28 rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <input
        name="predictedCostMax"
        type="number"
        step="0.01"
        placeholder="Predicted max"
        className="w-28 rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <input
        name="actualCost"
        type="number"
        step="0.01"
        placeholder="Actual"
        className="w-28 rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <select
        name="currency"
        defaultValue="GBP"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      >
        <option value="GBP">£ GBP</option>
        <option value="EUR">€ EUR</option>
      </select>
      <input
        name="optionDate"
        type="date"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <input
        name="contactName"
        placeholder="Contact name"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <input
        name="contactPhone"
        placeholder="Contact phone"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <input
        name="contactEmail"
        type="email"
        placeholder="Contact email"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <input
        name="latitude"
        type="number"
        step="any"
        min={-90}
        max={90}
        placeholder="Latitude"
        className="w-28 rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <input
        name="longitude"
        type="number"
        step="any"
        min={-180}
        max={180}
        placeholder="Longitude"
        className="w-28 rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2 text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add option"}
      </button>
      {error && <p className="w-full font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}
