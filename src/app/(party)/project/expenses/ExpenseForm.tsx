"use client";

import { useRef, useTransition } from "react";
import { logExpense } from "./actions";

export function ExpenseForm({
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
          await logExpense(formData);
          formRef.current?.reset();
        })
      }
      className="mt-6 flex flex-col gap-3 rounded-2xl border border-ink/10 bg-cream-deep/50 p-5"
    >
      <div className="flex flex-wrap gap-3">
        <input
          name="description"
          required
          placeholder="What was it for?"
          className="flex-1 rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="Amount (£)"
          className="w-40 rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
        />
        <select
          name="paidByContactId"
          required
          defaultValue=""
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
      </div>

      <div>
        <p className="text-xs text-ink-soft">Split evenly among</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {contacts.map((c) => (
            <label key={c.id} className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="splitAmong" value={c.id} />
              {c.full_name}
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={pending || contacts.length === 0}
        className="self-start rounded-full bg-ink px-5 py-2 text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Logging…" : "Log expense"}
      </button>
    </form>
  );
}
