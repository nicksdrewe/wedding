"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

// One bank-detail row with a tap-to-copy button — typing a sort code and
// account number by hand from a phone screen is where transfers go wrong.
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (older browsers, insecure context) — the value is
      // still on screen to read and select by hand.
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-cream/10 py-3.5 last:border-b-0">
      <div className="min-w-0">
        <p className="font-serif text-[11px] font-semibold tracking-[0.24em] text-cream/55 uppercase">
          {label}
        </p>
        <p className="mt-1 font-serif text-lg font-medium tracking-wide text-cream tabular-nums select-all">
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? `${label} copied` : `Copy ${label}`}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-cream/20 px-4 font-serif text-xs font-medium text-cream/80 transition-colors hover:border-cream/45 hover:text-cream"
      >
        {copied ? <Check className="h-4 w-4" strokeWidth={2.2} /> : <Copy className="h-4 w-4" strokeWidth={2} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
