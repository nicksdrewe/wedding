"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { setHiddenFromCouple } from "@/lib/hide/actions";

// "Hide from the couple" switch for the best man / maid of honour, on a plan,
// a task or an idea. Updates at once; rolls back with a message if refused.
export function HideToggle({
  kind,
  id,
  hidden,
  revalidate,
  className = "",
}: {
  kind: "category" | "task" | "idea";
  id: string;
  hidden: boolean;
  revalidate: string;
  className?: string;
}) {
  const [on, setOn] = useState(hidden);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className={className}>
      <button
        type="button"
        disabled={pending}
        aria-pressed={on}
        onClick={() => {
          const next = !on;
          setOn(next);
          setError(null);
          startTransition(async () => {
            const result = await setHiddenFromCouple(kind, id, next, revalidate);
            if (result?.error) {
              setOn(!next);
              setError(result.error);
            }
          });
        }}
        className={`inline-flex min-h-9 items-center gap-1.5 font-serif text-[10px] tracking-[0.06em] uppercase transition-colors disabled:opacity-60 ${on ? "text-accent" : "text-ink-soft hover:text-sec"}`}
      >
        {on ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
        {on ? "Hidden from couple · show" : "Hide from couple"}
      </button>
      {error && <span className="block font-reading text-[11px] text-alert">{error}</span>}
    </span>
  );
}
