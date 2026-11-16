"use client";

import { useMemo, useState } from "react";
import { ListChecks } from "lucide-react";
import { TaskForm } from "./TaskForm";
import { TaskRow } from "./TaskRow";
import { EmptyState } from "@/components/EmptyState";
import type { FeedbackData } from "@/lib/feedback/types";
import type { VisibleTag } from "@/lib/gendered/actions";
import { PRIORITIES, type BoardTask } from "@/lib/tasks/priority";

// The tasks "mini board": a visually distinct section (own background, lifted
// off the page, animated corner brackets) holding the add form, filters for
// urgency and assignee, and the task cards. Open tasks come first, most urgent
// then soonest due; done tasks sink to the bottom and can be hidden.
export function TaskBoard({
  tasks,
  contacts,
  visibleTag,
  canAdd,
  canDelete = true,
  feedback,
  canModerate = false,
  revalidate,
}: {
  tasks: BoardTask[];
  contacts: { id: string; full_name: string }[];
  visibleTag?: VisibleTag;
  canAdd: boolean;
  canDelete?: boolean;
  feedback: Record<string, FeedbackData>;
  canModerate?: boolean;
  revalidate: string;
}) {
  const [minPriority, setMinPriority] = useState(0);
  const [who, setWho] = useState("all");
  const [showDone, setShowDone] = useState(true);

  // Only people who actually have a task make useful filter choices.
  const assignees = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of tasks) if (t.ownerContactId && t.ownerName) seen.set(t.ownerContactId, t.ownerName);
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  }, [tasks]);

  const visible = useMemo(() => {
    return tasks
      .filter((t) => t.priority >= minPriority)
      .filter((t) => (who === "all" ? true : who === "none" ? !t.ownerContactId : t.ownerContactId === who))
      .filter((t) => showDone || !t.done)
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (!a.done && a.priority !== b.priority) return b.priority - a.priority;
        const ad = a.dueDate ?? "9999-12-31";
        const bd = b.dueDate ?? "9999-12-31";
        if (ad !== bd) return ad < bd ? -1 : 1;
        return a.createdAt < b.createdAt ? 1 : -1;
      });
  }, [tasks, minPriority, who, showDone]);

  const openCount = tasks.filter((t) => !t.done).length;
  const filtered = minPriority > 0 || who !== "all";

  return (
    <section className="task-board">
      <span className="task-board__corner task-board__corner--tl" aria-hidden="true" />
      <span className="task-board__corner task-board__corner--tr" aria-hidden="true" />
      <span className="task-board__corner task-board__corner--bl" aria-hidden="true" />
      <span className="task-board__corner task-board__corner--br" aria-hidden="true" />

      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sec-tint text-sec">
          <ListChecks className="h-5 w-5" strokeWidth={2} />
        </span>
        <div>
          <h2 className="font-title text-[26px] leading-none tracking-tight">Tasks</h2>
          <p className="mt-1 font-serif text-[12px] text-ink-soft">
            {openCount === 0 ? "All done" : `${openCount} to do`}
            {tasks.length > openCount && ` · ${tasks.length - openCount} done`}
          </p>
        </div>
      </div>

      {canAdd && (
        <div className="surface surface-raised mt-5 p-4 sm:p-5">
          <TaskForm contacts={contacts} visibleTag={visibleTag} />
        </div>
      )}

      {tasks.length > 0 && (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="min-w-[9rem] flex-1">
            <span className="field-label">Show</span>
            <select value={minPriority} onChange={(e) => setMinPriority(Number(e.target.value))} className="field">
              <option value={0}>All priorities</option>
              {PRIORITIES.filter((p) => p.value > 0).map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} and above
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[9rem] flex-1">
            <span className="field-label">Who</span>
            <select value={who} onChange={(e) => setWho(e.target.value)} className="field">
              <option value="all">Everyone</option>
              <option value="none">Unassigned</option>
              {assignees.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 font-serif text-[13px] text-ink-soft">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="h-4 w-4 accent-[var(--sec)]" />
            Show done
          </label>
        </div>
      )}

      <ul className="mt-5 flex flex-col gap-3">
        {visible.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            contacts={contacts}
            canDelete={canDelete}
            feedback={feedback[t.id]}
            canModerate={canModerate}
            revalidate={revalidate}
          />
        ))}
      </ul>
      {tasks.length === 0 && <EmptyState className="mt-5" title="No tasks yet" hint={canAdd ? "Add the first one above." : undefined} />}
      {tasks.length > 0 && visible.length === 0 && (
        <EmptyState className="mt-5" title="Nothing matches" hint={filtered ? "Try a different filter." : "Everything is done."} />
      )}
    </section>
  );
}
