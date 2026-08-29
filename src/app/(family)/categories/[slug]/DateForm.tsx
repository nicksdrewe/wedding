"use client";

import { useRef, useTransition } from "react";
import { addCategoryDate } from "../actions";

export function DateForm({ categoryPageId }: { categoryPageId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          await addCategoryDate(formData);
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
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-ink"
      />
      <input
        name="entryDate"
        type="date"
        required
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-ink"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2 text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add date"}
      </button>
    </form>
  );
}
