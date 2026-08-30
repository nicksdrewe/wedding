"use client";

import { useState, useTransition } from "react";
import { deleteIdea, updateIdea } from "./actions";

export function IdeaCard({
  id,
  title,
  body,
  canEdit,
}: {
  id: string;
  title: string;
  body: string | null;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm("Delete this idea? This can not be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteIdea(id);
      if (result?.error) setError(result.error);
    });
  }

  if (editing) {
    return (
      <li className="rounded-[10px] border border-ink/10 bg-white p-4">
        <form
          action={(formData) =>
            startTransition(async () => {
              setError(null);
              const result = await updateIdea(formData);
              if (result?.error) {
                setError(result.error);
                return;
              }
              setEditing(false);
            })
          }
          className="flex flex-col gap-2"
        >
          <input type="hidden" name="id" value={id} />
          <input
            name="title"
            required
            defaultValue={title}
            placeholder="Idea title"
            className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
          />
          <textarea
            name="body"
            defaultValue={body ?? ""}
            placeholder="Details (optional)"
            rows={2}
            className="rounded-2xl border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="self-start rounded-full bg-ink px-5 py-2 text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="self-start rounded-full border border-ink/20 px-5 py-2 text-sm text-ink-soft transition hover:border-ink/40"
            >
              Cancel
            </button>
          </div>
          {error && <p className="font-reading text-xs text-alert">{error}</p>}
        </form>
      </li>
    );
  }

  return (
    <li className="group rounded-[10px] border border-ink/10 bg-white p-4 transition-colors duration-150 hover:border-accent/40">
      <div className="flex items-start justify-between gap-3">
        <p className="font-serif text-sm font-semibold">{title}</p>
        {canEdit && (
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
        )}
      </div>
      {body && <p className="mt-1.5 font-reading text-[13px] text-ink-soft">{body}</p>}
      {error && <p className="mt-1.5 font-reading text-xs text-alert">{error}</p>}
    </li>
  );
}
