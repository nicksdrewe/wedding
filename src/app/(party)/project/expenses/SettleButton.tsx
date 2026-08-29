"use client";

import { useTransition } from "react";
import { markSplitSettled } from "./actions";

export function SettleButton({ splitId }: { splitId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => markSplitSettled(splitId))}
      className="rounded-full border border-ink/20 px-2 py-0.5 text-xs text-ink-soft transition hover:border-ink hover:text-ink disabled:opacity-60"
    >
      {pending ? "…" : "Mark settled"}
    </button>
  );
}
