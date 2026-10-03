"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { CopyField } from "@/components/gifts/CopyField";

// Bank details stay folded away until tapped, so the account number isn't
// sitting on screen for anyone glancing at the page. This is a courtesy,
// not security — the values are still in the page payload.
export function BankDetails({
  accountName,
  sortCode,
  accountNumber,
  reference,
  hasPayLink,
}: {
  accountName: string;
  sortCode: string;
  accountNumber: string;
  reference: string;
  hasPayLink: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-full border border-cream/25 px-6 py-3.5 font-serif text-sm font-medium text-cream transition-colors hover:border-cream/50 hover:bg-cream/5"
      >
        {open ? "Hide bank details" : hasPayLink ? "Or show bank transfer details" : "Show bank transfer details"}
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          strokeWidth={2.2}
        />
      </button>

      {open && (
        <div style={{ animation: "fadeUp 0.5s cubic-bezier(.22,1,.36,1) both" }}>
          <div className="mt-3">
            <CopyField label="Account name" value={accountName} />
            <CopyField label="Sort code" value={sortCode} />
            <CopyField label="Account number" value={accountNumber} />
            <CopyField label="Reference" value={reference} />
          </div>
          <p className="mt-4 font-reading text-sm text-cream/60 italic">
            Adding your name to the reference lets us thank you properly.
          </p>
        </div>
      )}
    </div>
  );
}
