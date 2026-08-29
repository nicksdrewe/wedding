"use client";

import { useRef, useState, useTransition } from "react";
import { createCategoryPage } from "./actions";

export function NewCategoryForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await createCategoryPage(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          formRef.current?.reset();
        })
      }
      className="mt-6 flex items-end gap-3"
    >
      <div className="flex flex-col">
        <label className="text-xs text-ink-soft">New category</label>
        <input
          name="title"
          required
          placeholder="e.g. Venue"
          className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2 text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add category"}
      </button>
      {error && <p className="pb-2 font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}
