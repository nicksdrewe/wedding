"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBudget } from "@/lib/wedding/actions";

// A budget you type in (the couple only). Saves when you leave the box or
// press Enter; empty clears it.
export function BudgetInput({
  categoryId,
  value,
  big = false,
  placeholder = "Set budget",
}: {
  categoryId: string | null;
  value: number | null;
  big?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const start0 = value == null ? "" : String(value);
  const [text, setText] = useState(start0);
  const [last, setLast] = useState(start0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    if (text.trim() === last.trim()) return;
    setError(null);
    start(async () => {
      const r = await setBudget({ categoryId, amount: text });
      if (r.error) setError(r.error);
      else {
        setLast(text);
        router.refresh();
      }
    });
  }

  return (
    <span className="inline-flex flex-col">
      <span
        className={`inline-flex items-center rounded-[10px] border border-ink/15 bg-paper focus-within:border-sec ${
          big ? "px-3 py-1.5" : "px-2 py-1"
        } ${pending ? "opacity-60" : ""}`}
      >
        <span className={`text-ink-soft ${big ? "font-title text-[26px]" : ""}`}>£</span>
        <input
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          placeholder={placeholder}
          aria-label={categoryId ? "Category budget" : "Wedding budget"}
          className={`min-w-0 bg-transparent tabular-nums outline-none placeholder:text-ink-soft/60 ${
            big ? "w-[9ch] font-title text-[26px]" : "w-[8ch] text-[13px]"
          }`}
        />
      </span>
      {error && <span className="mt-1 text-[11px] text-alert">{error}</span>}
    </span>
  );
}
