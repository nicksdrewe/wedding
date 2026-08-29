"use client";

import { useRef, useTransition } from "react";
import { createStandaloneOptionGroup } from "@/lib/options/actions";

export function NewOptionGroupForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          await createStandaloneOptionGroup(formData);
          formRef.current?.reset();
        })
      }
      className="mt-3 flex items-end gap-3"
    >
      <input
        name="title"
        required
        placeholder="e.g. Stag do venue"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-ink"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2 text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Starting…" : "Start comparison"}
      </button>
    </form>
  );
}
