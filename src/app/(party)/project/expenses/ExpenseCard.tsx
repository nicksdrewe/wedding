"use client";

import { useState, useTransition } from "react";
import { deleteExpense, updateExpense } from "./actions";
import { SettleButton } from "./SettleButton";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";

export function ExpenseCard({
  id,
  description,
  amount,
  paidByContactId,
  payerName,
  contacts,
  splits,
  canManage,
}: {
  id: string;
  description: string;
  amount: number;
  paidByContactId: string | null;
  payerName: string | null;
  contacts: { id: string; full_name: string }[];
  splits: { id: string; amount: number; settled: boolean; name: string | undefined }[];
  // Edit/delete an existing expense, or settle a split — narrower than
  // being able to log a new one (family can add expenses per 0028, but
  // not touch existing ones). RLS enforces this for real (0028's "family
  // reads/adds expenses" policies grant no UPDATE/DELETE), so this is
  // belt-and-braces UI hiding, not the actual security boundary.
  canManage: boolean;
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
      <li className="surface p-4">
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
            className="field flex-1"
          />
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={amount}
            className="field w-32"
          />
          <select
            name="paidByContactId"
            required
            defaultValue={paidByContactId ?? ""}
            className="field w-auto"
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
            className="btn btn-primary"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="btn btn-quiet"
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
    <li className="surface surface-lift group p-4 duration-150">
      <div className="flex items-center justify-between gap-3">
        <span className="font-serif text-sm font-semibold">{description}</span>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-serif text-sm">
            £<AnimatedNumber value={amount} springOptions={{ bounce: 0 }} />
          </span>
          {canManage && (
            <div className="flex gap-2 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="font-serif text-[11px] tracking-[0.06em] text-ink-soft uppercase hover:text-sec"
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
      </div>
      <p className="mt-1.5 font-reading text-[13px] text-ink-soft">
        Paid by {payerName ?? "—"}
      </p>
      <ul className="mt-3 flex flex-col gap-1.5 border-t border-ink/8 pt-2.5">
        {splits.map((s) => (
          <li key={s.id} className="flex items-center justify-between font-serif text-xs text-ink-soft">
            <span>
              {s.name} — £<AnimatedNumber value={s.amount} springOptions={{ bounce: 0 }} />{" "}
              {s.settled ? "(settled)" : ""}
            </span>
            {!s.settled && canManage && <SettleButton splitId={s.id} />}
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 font-reading text-xs text-alert">{error}</p>}
    </li>
  );
}
