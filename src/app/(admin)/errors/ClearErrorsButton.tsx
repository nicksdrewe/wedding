"use client";

import { useState, useTransition } from "react";
import { clearErrors } from "./actions";

export function ClearErrorsButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Clear the whole error list? This can not be undone.")) return;
          setError(null);
          startTransition(async () => {
            const result = await clearErrors();
            if (result.error) setError(result.error);
          });
        }}
        className="btn btn-quiet btn-sm"
      >
        {pending ? "Clearing…" : "Clear all"}
      </button>
      {error && <p className="font-reading text-[11px] text-alert">{error}</p>}
    </div>
  );
}
