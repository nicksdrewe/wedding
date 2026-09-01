"use client";

// Page-scoped near-copy of ../TaskForm.tsx — posts to createGenderedTask
// (src/lib/gendered/actions.ts) with a fixed visibleTag instead of the
// shared addTask, so the new row lands with visible_tag set rather than
// null.

import { useRef, useTransition } from "react";
import { createGenderedTask, type VisibleTag } from "@/lib/gendered/actions";

export function GenderedTaskForm({
  visibleTag,
  contacts,
}: {
  visibleTag: VisibleTag;
  contacts: { id: string; full_name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          await createGenderedTask(formData);
          formRef.current?.reset();
        })
      }
      className="mt-3 flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="visibleTag" value={visibleTag} />
      <input
        name="title"
        required
        placeholder="Task"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <select
        name="ownerContactId"
        defaultValue=""
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      >
        <option value="">Unassigned</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.full_name}
          </option>
        ))}
      </select>
      <input
        name="dueDate"
        type="date"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2 text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add task"}
      </button>
    </form>
  );
}
