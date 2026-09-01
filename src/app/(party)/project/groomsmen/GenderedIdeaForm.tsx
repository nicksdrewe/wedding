"use client";

// Page-scoped near-copy of ../IdeaForm.tsx — posts to createGenderedIdea
// (src/lib/gendered/actions.ts) with a fixed visibleTag instead of the
// shared addIdea, so the new row lands with visible_tag set rather than
// null. Not shared with /project/bridesmaids — that page has its own copy —
// to avoid touching the original shared component per the task brief.

import { useRef, useTransition } from "react";
import { createGenderedIdea, type VisibleTag } from "@/lib/gendered/actions";

export function GenderedIdeaForm({ visibleTag }: { visibleTag: VisibleTag }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          await createGenderedIdea(formData);
          formRef.current?.reset();
        })
      }
      className="mt-3 flex flex-col gap-2"
    >
      <input type="hidden" name="visibleTag" value={visibleTag} />
      <input
        name="title"
        required
        placeholder="Idea title"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <textarea
        name="body"
        placeholder="Details (optional)"
        rows={2}
        className="rounded-2xl border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <input
        name="tags"
        placeholder="Tags (comma, separated)"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
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
