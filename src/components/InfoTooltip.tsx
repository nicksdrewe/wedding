"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

const BUBBLE_WIDTH = 260;

// A plain speech-bubble tooltip: pale background, dark text, fixed
// comfortable width so it reads as a rectangle of prose, not a tall,
// unreadable sliver. Deliberately NOT built on MorphingPopover — that
// component morphs its content's geometry out of the trigger's own tiny
// bounding box via a shared layoutId, which is exactly what produced the
// cramped, illegible result here.
//
// Positioning has one real wrinkle: this can be opened from inside a
// motion-primitives Dialog, and that Dialog renders a native <dialog>
// shown via showModal() — which promotes it into the browser's "top
// layer", painted above the entire normal document regardless of z-index.
// A tooltip portaled to document.body would therefore render BEHIND the
// dialog, not above it. So: if the trigger sits inside an open <dialog>,
// portal into that same dialog element instead (still part of its
// top-layer subtree, so it can paint above the dialog's own content),
// positioned absolutely against the dialog's own box (the dialog is
// itself `position: fixed`, so it's the containing block for an absolute
// child). Outside a dialog, portal to document.body and position fixed
// against the viewport.
export function InfoTooltip({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<{ top: number; left: number; mode: "fixed" | "absolute" } | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function place() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const triggerRect = trigger.getBoundingClientRect();
      const dialog = trigger.closest("dialog");

      if (dialog) {
        setPortalTarget(dialog);
        // <dialog> computes overflow: auto by default, which clips any
        // child positioned past its own border box — exactly what made
        // the tooltip render "confined within" the dialog before this.
        // Safe to force visible unconditionally: these dialogs are small,
        // fixed-content cards that never rely on internal scrolling.
        dialog.style.overflow = "visible";
        const dialogRect = dialog.getBoundingClientRect();
        let left = triggerRect.left - dialogRect.left + triggerRect.width / 2 - BUBBLE_WIDTH / 2;
        left = Math.max(8, Math.min(left, dialogRect.width - BUBBLE_WIDTH - 8));
        setPlacement({ top: triggerRect.bottom - dialogRect.top + 8, left, mode: "absolute" });
      } else {
        setPortalTarget(document.body);
        let left = triggerRect.left + triggerRect.width / 2 - BUBBLE_WIDTH / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - BUBBLE_WIDTH - 8));
        setPlacement({ top: triggerRect.bottom + 8, left, mode: "fixed" });
      }
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || bubbleRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="More information"
        aria-expanded={open}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-ink-soft/60 transition-colors hover:text-ink ${className ?? ""}`}
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      {open &&
        placement &&
        portalTarget &&
        createPortal(
          <div
            ref={bubbleRef}
            role="tooltip"
            style={{ position: placement.mode, top: placement.top, left: placement.left, width: BUBBLE_WIDTH, zIndex: 9999 }}
            className="rounded-xl border border-ink/10 bg-cream px-4 py-3 shadow-lg"
          >
            <p className="font-reading text-[13px] leading-snug text-ink">{text}</p>
          </div>,
          portalTarget
        )}
    </>
  );
}
