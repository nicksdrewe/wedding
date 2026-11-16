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
      className="surface mt-6 flex flex-wrap items-end gap-3 p-4"
    >
      <div className="flex flex-col gap-1">
        <label className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
          New category
        </label>
        <input
          name="title"
          required
          placeholder="e.g. Venue"
          className="field w-auto"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary"
      >
        {pending ? "Adding…" : "Add category"}
      </button>
      {error && <p className="pb-2 font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}
