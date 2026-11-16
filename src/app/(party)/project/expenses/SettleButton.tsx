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
      className="btn btn-quiet btn-sm"
    >
      {pending ? "…" : "Mark settled"}
    </button>
  );
}
