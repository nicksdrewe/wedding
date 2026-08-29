"use client";

import { useRef, useTransition } from "react";
import { addTask } from "./actions";

export function TaskForm({
  contacts,
}: {
  contacts: { id: string; full_name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          await addTask(formData);
          formRef.current?.reset();
        })
      }
      className="mt-3 flex flex-wrap items-end gap-2"
    >
      <input
        name="title"
        required
        placeholder="Task"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-ink"
      />
      <select
        name="ownerContactId"
        defaultValue=""
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-ink"
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
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-ink"
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
