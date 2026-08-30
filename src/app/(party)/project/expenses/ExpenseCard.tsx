"use client";

import { useState, useTransition } from "react";
import { deleteExpense, updateExpense } from "./actions";
import { SettleButton } from "./SettleButton";

export function ExpenseCard({
  id,
  description,
  amount,
  paidByContactId,
  payerName,
  contacts,
  splits,
}: {
  id: string;
  description: string;
  amount: number;
  paidByContactId: string | null;
  payerName: string | null;
  contacts: { id: string; full_name: string }[];
  splits: { id: string; amount: number; settled: boolean; name: string | undefined }[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (
      !window.confirm(
        "Delete this expense? Its split among everyone (including anything already settled) will be deleted too. This can not be undone."
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await deleteExpense(id);
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
              const result = await updateExpense(formData);
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
            name="description"
            required
            defaultValue={description}
            className="flex-1 rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={amount}
            className="w-32 rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
          />
          <select
            name="paidByContactId"
            required
            defaultValue={paidByContactId ?? ""}
            className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="" disabled>
              Paid by…
            </option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-ink px-5 py-2 text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-full border border-ink/20 px-5 py-2 text-sm text-ink-soft transition hover:border-ink/40"
          >
            Cancel
          </button>
          <p className="w-full font-reading text-xs text-ink-soft/70 italic">
            Editing here changes the expense record only — the split among
            everyone stays as it was.
          </p>
          {error && <p className="w-full font-reading text-xs text-alert">{error}</p>}
        </form>
      </li>
    );
  }

  return (
    <li className="group rounded-[10px] border border-ink/10 bg-white p-4 transition-colors duration-150 hover:border-accent/40">
      <div className="flex items-center justify-between gap-3">
        <span className="font-serif text-sm font-semibold">{description}</span>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-serif text-sm">£{amount.toFixed(2)}</span>
          <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
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
        </div>
      </div>
      <p className="mt-1.5 font-reading text-[13px] text-ink-soft">
        Paid by {payerName ?? "—"}
      </p>
      <ul className="mt-3 flex flex-col gap-1.5 border-t border-ink/8 pt-2.5">
        {splits.map((s) => (
          <li key={s.id} className="flex items-center justify-between font-serif text-xs text-ink-soft">
            <span>
              {s.name} — £{s.amount.toFixed(2)} {s.settled ? "(settled)" : ""}
            </span>
            {!s.settled && <SettleButton splitId={s.id} />}
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 font-reading text-xs text-alert">{error}</p>}
    </li>
  );
}
