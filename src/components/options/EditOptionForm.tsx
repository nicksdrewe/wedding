"use client";

import { useState, useTransition } from "react";
import { LocationInput } from "@/components/LocationInput";
import { updateOption } from "@/lib/options/actions";
import type { OptionDetail } from "./OptionCard";
import type { OptionFields } from "@/lib/options/kinds";

// Full edit form for one option — every field, including description and
// web_link which AddOptionForm never exposed. Same rounded-full inputs and
// bg-ink/text-cream submit button as the rest of the app; Cancel resets to
// the view with no network call.
export function EditOptionForm({
  option,
  revalidate,
  fields = { location: true, stay: true },
  onCancel,
  onSaved,
}: {
  option: OptionDetail;
  revalidate: string;
  // Which boxes this kind of option needs (see lib/options/kinds.ts).
  fields?: OptionFields;
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

      {/* Hidden boxes keep what is already stored, so changing a category's kind never wipes data. */}
      {!fields.location && (
        <>
          <input type="hidden" name="latitude" value={option.latitude ?? ""} />
          <input type="hidden" name="longitude" value={option.longitude ?? ""} />
        </>
      )}
      {!fields.stay && (
        <>
          <input type="hidden" name="nights" value={option.nights ?? ""} />
          <input type="hidden" name="sleeps" value={option.sleeps ?? ""} />
        </>
      )}
      {(fields.location || fields.stay) && (
      <div className="flex flex-wrap gap-2">
        {fields.location && (
          <>
        <LocationInput className="w-full sm:w-96" defaultLat={option.latitude} defaultLng={option.longitude} />
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
          defaultValue={option.nights ?? ""}
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
          defaultValue={option.sleeps ?? ""}
          className="field w-24"
            placeholder="0"
            title="How many people it sleeps"
          />
        </label>
          </>
        )}
      </div>
      )}

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
