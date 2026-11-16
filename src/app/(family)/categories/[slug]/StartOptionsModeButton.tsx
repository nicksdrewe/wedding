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
      className="btn btn-quiet btn-sm"
    >
      {pending ? "Switching…" : "Switch to Options mode"}
    </button>
  );
}
