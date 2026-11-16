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
        className="field w-auto"
      />
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary"
      >
        {pending ? "Starting…" : "Start comparison"}
      </button>
    </form>
  );
}
