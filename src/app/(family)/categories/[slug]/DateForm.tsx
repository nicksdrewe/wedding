"use client";

import { useRef, useState, useTransition } from "react";
import { addCategoryDate } from "../actions";

export function DateForm({ categoryPageId }: { categoryPageId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await addCategoryDate(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          formRef.current?.reset();
        })
      }
      className="mt-3 flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="categoryPageId" value={categoryPageId} />
      <input
        name="title"
        required
        placeholder="What's happening"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <input
        name="entryDate"
        type="date"
        required
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2 text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add date"}
      </button>
      {error && <p className="w-full font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}
