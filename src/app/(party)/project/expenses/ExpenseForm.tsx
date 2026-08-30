"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { logExpense } from "./actions";

type SplitMode = "even" | "percent" | "amount";

const MODE_LABEL: Record<SplitMode, string> = {
  even: "Split evenly",
  percent: "Split by %",
  amount: "Split by exact amount",
};

export function ExpenseForm({
  contacts,
}: {
  contacts: { id: string; full_name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<SplitMode>("even");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Raw text per contact for percent/amount modes — kept as strings (not
  // numbers) so a half-typed value like "3." or an empty field doesn't
  // fight the user's cursor mid-edit.
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const totalAmount = Number(amount) || 0;

  function toggleContact(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // The actual per-person amounts this submission will log, computed the
  // same way regardless of mode — even split divides live so it always
  // reflects the current amount/selection, custom modes read straight from
  // what's typed in.
  const computedSplits = useMemo(() => {
    const ids = [...selected];
    if (ids.length === 0) return [];
    if (mode === "even") {
      const share = Math.round((totalAmount / ids.length) * 100) / 100;
      return ids.map((id) => ({ contactId: id, amount: share }));
    }
    if (mode === "percent") {
      return ids.map((id) => {
        const pct = Number(customValues[id]) || 0;
        return { contactId: id, amount: Math.round(totalAmount * (pct / 100) * 100) / 100 };
      });
    }
    return ids.map((id) => ({ contactId: id, amount: Number(customValues[id]) || 0 }));
  }, [selected, mode, customValues, totalAmount]);

  const splitSum = computedSplits.reduce((sum, s) => sum + s.amount, 0);
  const percentSum = mode === "percent"
    ? [...selected].reduce((sum, id) => sum + (Number(customValues[id]) || 0), 0)
    : null;

  // Same rounding-slack reasoning as the server side — this is just the
  // form's own live indicator, the action re-checks with its own tolerance
  // regardless of what this shows.
  const tolerance = Math.max(0.02, computedSplits.length * 0.01);
  const isCustomMode = mode !== "even";
  const isBalanced = !isCustomMode || Math.abs(splitSum - totalAmount) <= tolerance;
  const canSubmit = selected.size > 0 && totalAmount > 0 && (!isCustomMode || isBalanced);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;

    const formData = new FormData(e.currentTarget);
    formData.set("splits", JSON.stringify(computedSplits));

    setError(null);
    startTransition(async () => {
      const result = await logExpense(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
      setSelected(new Set());
      setCustomValues({});
      setAmount("");
      setMode("even");
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="mt-6 flex flex-col gap-4 rounded-2xl border border-ink/10 bg-cream-deep/50 p-5"
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
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
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
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-soft">Split among</p>
          <div className="flex gap-0.5 rounded-full bg-cream p-0.5">
            {(Object.keys(MODE_LABEL) as SplitMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-full px-3 py-1 font-serif text-[11px] tracking-wide transition ${
                  mode === m ? "bg-ink text-cream" : "text-ink-soft hover:text-ink"
                }`}
              >
                {m === "even" ? "Even" : m === "percent" ? "By %" : "By amount"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-1.5">
          {contacts.map((c) => {
            const checked = selected.has(c.id);
            return (
              <div key={c.id} className="flex items-center gap-2.5">
                <label className="flex flex-1 items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleContact(c.id)}
                  />
                  {c.full_name}
                </label>
                {checked && isCustomMode && (
                  <div className="flex items-center gap-1">
                    {mode === "amount" && <span className="text-xs text-ink-soft">£</span>}
                    <input
                      type="number"
                      step={mode === "percent" ? "1" : "0.01"}
                      min="0"
                      value={customValues[c.id] ?? ""}
                      onChange={(e) =>
                        setCustomValues((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      placeholder="0"
                      className="w-20 rounded-full border border-ink/20 bg-cream px-3 py-1 text-right text-sm outline-none focus:border-accent"
                    />
                    {mode === "percent" && <span className="text-xs text-ink-soft">%</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isCustomMode && selected.size > 0 && (
          <p className={`mt-2 font-reading text-xs ${isBalanced ? "text-ink-soft" : "text-alert"}`}>
            {mode === "percent"
              ? `${(percentSum ?? 0).toFixed(0)}% of 100%`
              : `£${splitSum.toFixed(2)} of £${totalAmount.toFixed(2)}`}
            {!isBalanced && " — doesn't add up yet"}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending || contacts.length === 0 || !canSubmit}
        className="self-start rounded-full bg-ink px-5 py-2 text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Logging…" : "Log expense"}
      </button>

      {error && <p className="font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}
