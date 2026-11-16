"use client";

import { useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import { addTask } from "./actions";
import { createGenderedTask, type VisibleTag } from "@/lib/gendered/actions";
import { DEFAULT_PRIORITY, PRIORITIES } from "@/lib/tasks/priority";

// One add-task form for all three boards: with a visibleTag it posts to the
// stag/hen action (so the row lands tagged to that board), without one to the
// main project action.
export function TaskForm({
  contacts,
  visibleTag,
}: {
  contacts: { id: string; full_name: string }[];
  visibleTag?: VisibleTag;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          if (visibleTag) await createGenderedTask(formData);
          else await addTask(formData);
          formRef.current?.reset();
        })
      }
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {visibleTag && <input type="hidden" name="visibleTag" value={visibleTag} />}
      <label className="sm:col-span-2">
        <span className="field-label">New task</span>
        <input name="title" required placeholder="What needs doing?" className="field" />
      </label>
      <label>
        <span className="field-label">Who</span>
        <select name="ownerContactId" defaultValue="" className="field">
          <option value="">Unassigned</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label">Due</span>
        <input name="dueDate" type="date" className="field" />
      </label>
      <label>
        <span className="field-label">Priority</span>
        <select name="priority" defaultValue={DEFAULT_PRIORITY} className="field">
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end">
        <button type="submit" disabled={pending} className="btn btn-sec w-full">
          <Plus className="h-4 w-4" strokeWidth={2} />
          {pending ? "Adding…" : "Add task"}
        </button>
      </div>
    </form>
  );
}
