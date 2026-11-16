"use client";

import { useState, useTransition } from "react";
import { updateOption } from "@/lib/options/actions";
import type { OptionDetail } from "./OptionCard";

// Full edit form for one option — every field, including description and
// web_link which AddOptionForm never exposed. Same rounded-full inputs and
// bg-ink/text-cream submit button as the rest of the app; Cancel resets to
// the view with no network call.
export function EditOptionForm({
  option,
  revalidate,
  onCancel,
  onSaved,
}: {
  option: OptionDetail;
  revalidate: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await updateOption(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          onSaved();
        })
      }
      className="flex flex-col gap-2.5"
    >
      <input type="hidden" name="id" value={option.id} />
      <input type="hidden" name="revalidate" value={revalidate} />

      <div className="flex flex-wrap gap-2">
        <input
          name="name"
          required
          defaultValue={option.name}
          placeholder="Option name"
          className="field w-auto"
        />
        {/* Cost inputs only exist for someone allowed to see prices; the
            hasCostFields marker tells updateOption it may write them. Without
            it the action leaves existing prices untouched. */}
        {!option.costs_hidden && (
          <>
        <input type="hidden" name="hasCostFields" value="1" />
        <input
          name="predictedCostMin"
          type="number"
          step="0.01"
          defaultValue={option.predicted_cost_min ?? ""}
          placeholder="Predicted min"
          className="field w-28"
        />
        <input
          name="predictedCostMax"
          type="number"
          step="0.01"
          defaultValue={option.predicted_cost_max ?? ""}
          placeholder="Predicted max"
          className="field w-28"
        />
        <input
          name="actualCost"
          type="number"
          step="0.01"
          defaultValue={option.actual_cost ?? ""}
          placeholder="Actual"
          className="field w-28"
        />
        <select
          name="currency"
          defaultValue={option.currency}
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
          defaultValue={option.option_date ?? ""}
          className="field w-auto"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          name="contactName"
          defaultValue={option.contact_name ?? ""}
          placeholder="Contact name"
          className="field w-auto"
        />
        <input
          name="contactPhone"
          defaultValue={option.contact_phone ?? ""}
          placeholder="Contact phone"
          className="field w-auto"
        />
        <input
          name="contactEmail"
          type="email"
          defaultValue={option.contact_email ?? ""}
          placeholder="Contact email"
          className="field w-auto"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          name="latitude"
          type="number"
          step="any"
          min={-90}
          max={90}
          defaultValue={option.latitude ?? ""}
          placeholder="Latitude"
          className="field w-32"
        />
        <input
          name="longitude"
          type="number"
          step="any"
          min={-180}
          max={180}
          defaultValue={option.longitude ?? ""}
          placeholder="Longitude"
          className="field w-32"
        />
        <input
          name="nights"
          type="number"
          min={0}
          step={1}
          defaultValue={option.nights ?? ""}
          placeholder="Nights"
          className="field w-24"
        />
        <input
          name="sleeps"
          type="number"
          min={0}
          step={1}
          defaultValue={option.sleeps ?? ""}
          placeholder="Sleeps"
          className="field w-24"
        />
      </div>

      <input
        name="webLink"
        defaultValue={option.web_link ?? ""}
        placeholder="Web link"
        className="field w-auto"
      />

      <textarea
        name="description"
        defaultValue={option.description ?? ""}
        placeholder="Description"
        rows={3}
        className="field w-auto"
      />

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary btn-sm"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-quiet btn-sm"
        >
          Cancel
        </button>
        {error && <p className="font-reading text-xs text-alert">{error}</p>}
      </div>
    </form>
  );
}
