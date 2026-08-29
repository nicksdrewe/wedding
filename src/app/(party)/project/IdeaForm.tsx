"use client";

import { useRef, useTransition } from "react";
import { addIdea } from "./actions";

export function IdeaForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          await addIdea(formData);
          formRef.current?.reset();
        })
      }
      className="mt-3 flex flex-col gap-2"
    >
      <input
        name="title"
        required
        placeholder="Idea title"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-ink"
      />
      <textarea
        name="body"
        placeholder="Details (optional)"
        rows={2}
        className="rounded-2xl border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-ink"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-ink px-5 py-2 text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add idea"}
      </button>
    </form>
  );
}
