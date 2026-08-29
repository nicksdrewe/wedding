"use client";

import { useState, useTransition } from "react";
import { selectWinner } from "@/lib/options/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/motion-primitives/dialog";

export type OptionRow = {
  id: string;
  name: string;
  predicted_cost: number | null;
  actual_cost: number | null;
  option_date: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  is_winner: boolean;
};

// The comparison + commit ritual: picking a winner isn't an instant swap.
// The chosen card locks and gains weight (border, shadow, seal) after a
// deliberate pause; the others recede together. The decision should be felt,
// since selecting a winner here rewrites the category's live cost, date and
// contact everywhere they appear.
const COMMIT_DELAY_MS = 900;

export function OptionsGrid({
  groupId,
  categoryPageId,
  revalidate,
  options,
}: {
  groupId: string;
  categoryPageId: string | null;
  revalidate: string;
  options: OptionRow[];
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // Only category-linked groups get the confirm dialog first — that's the
  // path that rewrites the live budget/diary/contacts everywhere they
  // appear, which is worth a deliberate stop. A standalone (Project
  // Management) group's winner is informational only, so it goes straight
  // into the commit ritual.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const hasWinner = options.some((o) => o.is_winner);
  const pendingOption = options.find((o) => o.id === pendingId);

  function requestSelect(optionId: string) {
    if (confirmingId || hasWinner) return;
    if (categoryPageId) {
      setPendingId(optionId);
      return;
    }
    commit(optionId);
  }

  function commit(optionId: string) {
    setPendingId(null);
    setConfirmingId(optionId);
    setTimeout(() => {
      startTransition(async () => {
        await selectWinner(groupId, optionId, categoryPageId, revalidate);
        setConfirmingId(null);
      });
    }, COMMIT_DELAY_MS);
  }

  function cardClasses(o: OptionRow) {
    if (o.is_winner) {
      return "border-2 border-accent bg-cream shadow-[0_8px_24px_rgba(76,107,82,0.18)] scale-100 opacity-100";
    }
    if (hasWinner) {
      return "border border-ink/10 bg-cream-deep opacity-50 scale-[0.97]";
    }
    if (confirmingId === o.id) {
      return "border border-accent bg-cream shadow-[0_6px_18px_rgba(76,107,82,0.15)] scale-[1.01] opacity-100";
    }
    if (confirmingId) {
      return "border border-ink/10 bg-cream-deep opacity-40 scale-[0.97]";
    }
    return "border border-ink/10 bg-cream-deep opacity-100 scale-100";
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {options.map((o) => (
        <div
          key={o.id}
          className={`relative rounded-[10px] p-5 font-serif text-sm transition-[opacity,transform,border-color,box-shadow] duration-[260ms] ease-[cubic-bezier(.22,1,.36,1)] ${cardClasses(o)}`}
        >
          {o.is_winner && (
            <span className="absolute -top-2.5 right-4 rounded-full bg-accent px-3 py-1 font-serif text-[10px] tracking-wide text-cream uppercase">
              Selected
            </span>
          )}
          <span className="font-semibold">{o.name}</span>
          <p className="mt-2 font-reading text-[13px] text-ink-soft">
            £{o.predicted_cost ?? "—"} predicted
            {o.actual_cost != null ? ` · £${o.actual_cost} actual` : ""}
          </p>
          {o.option_date && (
            <p className="mt-1 font-reading text-[13px] text-ink-soft">{o.option_date}</p>
          )}
          {o.contact_name && (
            <p className="mt-1 font-reading text-[13px] text-ink-soft">
              {o.contact_name}
              {o.contact_phone ? ` · ${o.contact_phone}` : ""}
            </p>
          )}
          {!o.is_winner && !hasWinner && (
            <button
              type="button"
              disabled={!!confirmingId}
              onClick={() => requestSelect(o.id)}
              className="mt-4 rounded-full border border-ink/20 px-4.5 py-2 font-serif text-xs text-ink-soft transition hover:border-ink/40 disabled:opacity-60"
            >
              {confirmingId === o.id ? "Confirming…" : "Select this option"}
            </button>
          )}
        </div>
      ))}
      {options.length === 0 && (
        <p className="font-reading text-sm text-ink-soft">
          No options logged yet — add at least two to compare.
        </p>
      )}

      <Dialog open={!!pendingId} onOpenChange={(open) => !open && setPendingId(null)}>
        <DialogContent className="w-[320px] max-w-[90vw] bg-cream p-7">
          <DialogHeader>
            <DialogTitle className="font-serif text-base font-semibold text-ink">
              Confirm {pendingOption?.name}?
            </DialogTitle>
            <DialogDescription className="font-reading text-sm text-ink-soft">
              This updates the cost, date and contact for this category
              everywhere they appear.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={() => pendingId && commit(pendingId)}
              className="rounded-full bg-ink px-5 py-2 font-serif text-xs text-cream transition hover:bg-ink-soft"
            >
              Confirm
            </button>
            <DialogClose className="rounded-full border border-ink/20 px-5 py-2 font-serif text-xs text-ink-soft transition hover:border-ink/40">
              Cancel
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
