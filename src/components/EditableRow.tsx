"use client";

import { useState, useTransition, type ReactNode } from "react";

// Shared inline edit-in-place pattern for simple list rows (category
// contacts, diary dates, ...): toggles between a display view and the
// same form used to create the record, pre-filled via defaultValues.
// No modal, no route change — matches the rounded-full inputs and
// bg-ink/text-cream submit button already established across the app.
export function EditableRow<T extends { id: string }>({
  item,
  isCouple,
  renderView,
  renderForm,
  onDelete,
  confirmMessage = "Delete this? This can not be undone.",
}: {
  item: T;
  isCouple: boolean;
  renderView: (item: T) => ReactNode;
  renderForm: (props: { item: T; onCancel: () => void; onSaved: () => void }) => ReactNode;
  onDelete?: (id: string) => Promise<{ error: string | null }>;
  confirmMessage?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!onDelete) return;
    if (!window.confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      const result = await onDelete(item.id);
      if (result?.error) setError(result.error);
    });
  }

  if (editing) {
    return renderForm({ item, onCancel: () => setEditing(false), onSaved: () => setEditing(false) });
  }

  return (
    <li className="group flex items-center justify-between gap-3 rounded-[8px] border border-ink/8 bg-cream/50 px-3 py-2">
      {renderView(item)}
      {isCouple && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex shrink-0 gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-serif text-[11px] tracking-[0.06em] text-ink-soft uppercase hover:text-accent"
            >
              Edit
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="font-serif text-[11px] tracking-[0.06em] text-alert/80 uppercase hover:text-alert disabled:opacity-60"
              >
                {pending ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>
          {error && <p className="font-reading text-[11px] text-alert">{error}</p>}
        </div>
      )}
    </li>
  );
}
