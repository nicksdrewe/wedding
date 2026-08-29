"use client";

import { useTransition } from "react";
import { startOptionsMode } from "@/lib/options/actions";

export function StartOptionsModeButton({
  categoryPageId,
  title,
  revalidate,
}: {
  categoryPageId: string;
  title: string;
  revalidate: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await startOptionsMode(categoryPageId, title, revalidate);
        })
      }
      className="rounded-full border border-ink/20 px-4 py-2 text-xs text-ink-soft transition hover:border-ink hover:text-ink disabled:opacity-60"
    >
      {pending ? "Switching…" : "Switch to Options mode"}
    </button>
  );
}
