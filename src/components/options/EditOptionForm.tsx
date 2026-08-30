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
          className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          name="predictedCost"
          type="number"
          step="0.01"
          defaultValue={option.predicted_cost ?? ""}
          placeholder="Predicted £"
          className="w-32 rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          name="actualCost"
          type="number"
          step="0.01"
          defaultValue={option.actual_cost ?? ""}
          placeholder="Actual £"
          className="w-32 rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          name="optionDate"
          type="date"
          defaultValue={option.option_date ?? ""}
          className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          name="contactName"
          defaultValue={option.contact_name ?? ""}
          placeholder="Contact name"
          className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          name="contactPhone"
          defaultValue={option.contact_phone ?? ""}
          placeholder="Contact phone"
          className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          name="contactEmail"
          type="email"
          defaultValue={option.contact_email ?? ""}
          placeholder="Contact email"
          className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
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
          className="w-32 rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          name="longitude"
          type="number"
          step="any"
          min={-180}
          max={180}
          defaultValue={option.longitude ?? ""}
          placeholder="Longitude"
          className="w-32 rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      <input
        name="webLink"
        defaultValue={option.web_link ?? ""}
        placeholder="Web link"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />

      <textarea
        name="description"
        defaultValue={option.description ?? ""}
        placeholder="Description"
        rows={3}
        className="rounded-[10px] border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-5 py-2 font-serif text-xs text-cream transition hover:bg-ink-soft disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-ink/20 px-5 py-2 font-serif text-xs text-ink-soft transition hover:border-ink/40"
        >
          Cancel
        </button>
        {error && <p className="font-reading text-xs text-alert">{error}</p>}
      </div>
    </form>
  );
}
