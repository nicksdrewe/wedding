"use client";

import { Info } from "lucide-react";
import {
  MorphingPopover,
  MorphingPopoverTrigger,
  MorphingPopoverContent,
} from "@/components/motion-primitives/morphing-popover";

// One shared "i" icon + reveal, so explanatory copy that used to sit as
// always-visible paragraph text can collapse behind a single consistent
// control instead of every page building its own tooltip. Kept always
// visible (not hover-hidden like the edit/delete button pattern used
// elsewhere) — an info affordance needs to be discoverable, not hidden
// until a visitor already knows to look for it; only its color shifts on
// hover as a hint that it's interactive.
export function InfoTooltip({ text, className }: { text: string; className?: string }) {
  return (
    <MorphingPopover className={className}>
      <MorphingPopoverTrigger
        className="flex h-5 w-5 items-center justify-center rounded-full text-ink-soft/60 transition-colors hover:text-ink"
        aria-label="More information"
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2} />
      </MorphingPopoverTrigger>
      <MorphingPopoverContent className="max-w-[280px] px-3.5 py-2.5">
        <p className="font-reading text-[13px] text-ink-soft">{text}</p>
      </MorphingPopoverContent>
    </MorphingPopover>
  );
}
