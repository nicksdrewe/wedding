"use client";

import { useRef, useState, useTransition } from "react";
import { addCategoryDate, updateCategoryDate } from "../actions";

type DiaryEntry = { id: string; title: string; entry_date: string };

export function DateForm({
  categoryPageId,
  entry,
  onCancel,
  onSaved,
}: {
  categoryPageId: string;
  entry?: DiaryEntry;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!entry;

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = isEditing
            ? await updateCategoryDate(formData)
            : await addCategoryDate(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          if (isEditing) {
            onSaved?.();
          } else {
            formRef.current?.reset();
          }
        })
      }
      className="mt-4 flex flex-wrap items-end gap-3"
    >
      {isEditing ? (
        <input type="hidden" name="id" value={entry.id} />
      ) : (
        <input type="hidden" name="categoryPageId" value={categoryPageId} />
      )}
      <input
        name="title"
        required
        defaultValue={entry?.title}
        placeholder="What's happening"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors focus:border-accent"
      />
      <input
        name="entryDate"
        type="date"
        required
        defaultValue={entry?.entry_date}
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2 text-sm text-cream transition-colors hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Saving…" : isEditing ? "Save" : "Add date"}
      </button>
      {isEditing && (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-ink/20 px-5 py-2 text-sm text-ink-soft transition-colors hover:border-ink/40"
        >
          Cancel
        </button>
      )}
      {error && <p className="w-full font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}
