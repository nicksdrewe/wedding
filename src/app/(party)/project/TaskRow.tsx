"use client";

import { useRef, useState, useTransition } from "react";
import { deleteTask, toggleTask, updateTask } from "./actions";

export function TaskRow({
  id,
  title,
  done,
  dueDate,
  ownerContactId,
  ownerName,
  contacts,
}: {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
  ownerContactId: string | null;
  ownerName: string | null;
  contacts: { id: string; full_name: string }[];
}) {
  const [pending, startTransition] = useTransition();
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

  if (editing) {
    return (
      <li className="rounded-[10px] border border-ink/10 bg-white px-4 py-3">
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
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="id" value={id} />
          <input
            name="title"
            required
            defaultValue={title}
            className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
          />
          <select
            name="ownerContactId"
            defaultValue={ownerContactId ?? ""}
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
            defaultValue={dueDate ?? ""}
            className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-ink px-5 py-2 text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-full border border-ink/20 px-5 py-2 text-sm text-ink-soft transition hover:border-ink/40"
          >
            Cancel
          </button>
          {error && <p className="w-full font-reading text-xs text-alert">{error}</p>}
        </form>
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-3 rounded-[10px] border border-ink/10 bg-white px-4 py-3 font-serif text-[13px]">
      <input
        type="checkbox"
        checked={done}
        disabled={pending}
        onChange={(e) => startTransition(() => toggleTask(id, e.target.checked))}
      />
      <span className={done ? "flex-1 text-ink-soft line-through" : "flex-1"}>
        {title}
      </span>
      {ownerName && <span className="text-[11px] text-ink-soft">{ownerName}</span>}
      {dueDate && <span className="text-[11px] text-ink-soft">{dueDate}</span>}
      <div className="flex shrink-0 gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="font-serif text-[11px] tracking-[0.06em] text-ink-soft uppercase hover:text-accent"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="font-serif text-[11px] tracking-[0.06em] text-alert/80 uppercase hover:text-alert"
        >
          Delete
        </button>
      </div>
      {error && <p className="w-full font-reading text-xs text-alert">{error}</p>}
    </li>
  );
}
