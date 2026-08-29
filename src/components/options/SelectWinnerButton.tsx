"use client";

import { useTransition } from "react";
import { selectWinner } from "@/lib/options/actions";

export function SelectWinnerButton({
  groupId,
  optionId,
  categoryPageId,
  revalidate,
}: {
  groupId: string;
  optionId: string;
  categoryPageId: string | null;
  revalidate: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => selectWinner(groupId, optionId, categoryPageId, revalidate))
      }
      className="rounded-full border border-ink/20 px-4 py-1.5 text-xs text-ink-soft transition hover:border-gold hover:text-gold disabled:opacity-60"
    >
      {pending ? "Selecting…" : "Select this option"}
    </button>
  );
}
