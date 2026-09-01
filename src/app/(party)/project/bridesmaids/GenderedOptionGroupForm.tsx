"use client";

// Page-scoped near-copy of ../NewOptionGroupForm.tsx — posts to
// createGenderedOptionGroup (src/lib/gendered/actions.ts) with a fixed
// visibleTag instead of the shared createStandaloneOptionGroup, so the new
// group lands with visible_tag set rather than null. Adding options INTO an
// existing group still goes through the shared addOption action
// (src/lib/options/actions.ts, via the shared AddOptionForm rendered inside
// OptionsCompareGroup) — that action doesn't need to know about visible_tag.

import { useRef, useTransition } from "react";
import { createGenderedOptionGroup, type VisibleTag } from "@/lib/gendered/actions";

export function GenderedOptionGroupForm({ visibleTag }: { visibleTag: VisibleTag }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          await createGenderedOptionGroup(formData);
          formRef.current?.reset();
        })
      }
      className="mt-3 flex items-end gap-3"
    >
      <input type="hidden" name="visibleTag" value={visibleTag} />
      <input
        name="title"
        required
        placeholder="e.g. Hen do venue"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
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
