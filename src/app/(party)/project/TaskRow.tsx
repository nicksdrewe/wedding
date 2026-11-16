"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { deleteTask, toggleTask, updateTask } from "./actions";
import { Feedback } from "@/components/feedback/Feedback";
import { HideToggle } from "@/components/ui/HideToggle";
import type { FeedbackData } from "@/lib/feedback/types";
import { PRIORITIES, priorityLabel, priorityTone, type BoardTask } from "@/lib/tasks/priority";

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function TaskRow({
  task,
  contacts,
  canDelete = true,
  canHide = false,
  hidden = false,
  feedback,
  canInteract = true,
  canModerate = false,
  revalidate = "/project",
}: {
  task: BoardTask;
  contacts: { id: string; full_name: string }[];
  // On a stag/hen board only the project's admin may delete a task
  // (0034_project_admins_and_budgets.sql); everyone on the board can still
  // add, edit and tick them off.
  canDelete?: boolean;
  canHide?: boolean;
  hidden?: boolean;
  // Comments on the task (0037) — tasks take comments only, no thumbs.
  feedback?: FeedbackData;
  canInteract?: boolean;
  canModerate?: boolean;
  revalidate?: string;
}) {
  const { id, title, done: serverDone, priority, dueDate, createdAt, doneAt, ownerContactId, ownerName } = task;
  const [pending, startTransition] = useTransition();
  // Ticking shows at once; the server catches up in the background.
  const [done, setDone] = useOptimistic(serverDone, (_current: boolean, next: boolean) => next);
  const [editing, setEditing] = useState(false);
  const [saving, startSaveTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleDelete() {
    if (!window.confirm("Delete this task? This can not be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteTask(id);
      if (result?.error) setError(result.error);
    });
  }

  const overdue = !done && !!dueDate && dueDate < new Date().toISOString().slice(0, 10);

  if (editing) {
    return (
      <li className="task-card task-card--edit">
        <form
          ref={formRef}
          action={(formData) =>
            startSaveTransition(async () => {
              setError(null);
              const result = await updateTask(formData);
              if (result?.error) {
                setError(result.error);
                return;
              }
              setEditing(false);
            })
          }
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="id" value={id} />
          <label className="sm:col-span-2">
            <span className="field-label">Task</span>
            <input name="title" required defaultValue={title} className="field" />
          </label>
          <label>
            <span className="field-label">Who</span>
            <select name="ownerContactId" defaultValue={ownerContactId ?? ""} className="field">
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
            <input name="dueDate" type="date" defaultValue={dueDate ?? ""} className="field" />
          </label>
          <label>
            <span className="field-label">Priority</span>
            <select name="priority" defaultValue={priority} className="field">
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" disabled={saving} className="btn btn-sec flex-1">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-quiet">
              Cancel
            </button>
          </div>
          {error && <p className="font-reading text-xs text-alert sm:col-span-2">{error}</p>}
        </form>
      </li>
    );
  }

  return (
    <li className={`task-card group ${done ? "task-card--done" : ""} ${!done && priority === 4 ? "task-card--urgent" : ""}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? "Mark as not done" : "Mark as done"}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setDone(!done);
              await toggleTask(id, !done);
            })
          }
          className="task-tick mt-0.5"
          data-done={done}
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </button>
        <div className="min-w-0 flex-1">
          <p className={`font-serif text-[15px] leading-snug ${done ? "text-ink-soft line-through" : "text-ink"}`}>{title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className={`chip ${priorityTone(priority)}`}>{priorityLabel(priority)}</span>
            {ownerName && <span className="font-serif text-[12px] text-ink-soft">{ownerName}</span>}
            {dueDate && (
              <span className={`font-serif text-[12px] ${overdue ? "font-semibold text-alert" : "text-ink-soft"}`}>
                {overdue ? "Overdue · " : "Due "}
                {shortDate(dueDate)}
              </span>
            )}
            {done && doneAt && <span className="font-serif text-[12px] text-accent">Done {shortDate(doneAt)}</span>}
            <span className="font-serif text-[11px] text-ink-soft/60">Added {shortDate(createdAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-3 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-8 font-serif text-[11px] tracking-[0.06em] text-ink-soft uppercase hover:text-sec"
          >
            Edit
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="min-h-8 font-serif text-[11px] tracking-[0.06em] text-alert/80 uppercase hover:text-alert"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      {canHide && <HideToggle kind="task" id={id} hidden={hidden} revalidate={revalidate} />}
        <Feedback
        targetType="task"
        targetId={id}
        data={feedback}
        canInteract={canInteract}
        canModerate={canModerate}
        revalidate={revalidate}
        showReactions={false}
        className="mt-2 w-full"
      />
      {error && <p className="mt-2 font-reading text-xs text-alert">{error}</p>}
    </li>
  );
}
