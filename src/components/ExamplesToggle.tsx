"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { setExamples } from "@/lib/wedding/actions";
import { useWedding } from "@/components/WeddingProvider";

// The examples switch: fills every planning page with a made-up wedding plan
// so the couple can see how things work, and clears it all again. The first
// time the couple sees it, a little note points at it (remembered per
// browser, per wedding).

const hintKey = (slug: string) => `ww-examples-hint:${slug || "site"}`;
const barKey = (slug: string) => `ww-examples-bar:${slug || "site"}`;
const BAR_EVENT = "ww-examples-bar";

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Whether the switch sits in the top bar. It's there for a first visit (with
 * the note pointing at it); after that only if the couple ticks "show the
 * switch in the top bar" in settings.
 */
export function useExamplesInBar(slug: string) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const pref = read(barKey(slug));
    // decided once per page load, so dismissing the note doesn't snatch the switch away mid-look
    setShown(pref === "show" || (pref !== "hide" && !read(hintKey(slug))));
    const onPref = (e: Event) => setShown((e as CustomEvent<boolean>).detail);
    window.addEventListener(BAR_EVENT, onPref);
    return () => window.removeEventListener(BAR_EVENT, onPref);
  }, [slug]);
  const set = (show: boolean) => {
    try {
      localStorage.setItem(barKey(slug), show ? "show" : "hide");
    } catch {}
    window.dispatchEvent(new CustomEvent(BAR_EVENT, { detail: show }));
  };
  return [shown, set] as const;
}

/** The header's copy of the switch: only there when useExamplesInBar says so. */
export function HeaderExamplesToggle() {
  const wedding = useWedding();
  const [shown] = useExamplesInBar(wedding.slug);
  return shown ? <ExamplesToggle withHint /> : null;
}

/** Settings: the tick box that keeps the switch in the top bar. */
export function ExamplesBarOption() {
  const wedding = useWedding();
  const [shown, set] = useExamplesInBar(wedding.slug);
  const id = useId();
  return (
    <label htmlFor={id} className="mt-3 flex cursor-pointer items-center gap-2.5 font-serif text-[13.5px] text-ink">
      <input id={id} type="checkbox" checked={shown} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-[var(--sec)]" />
      Show the switch in the top bar
    </label>
  );
}

export function ExamplesToggle({ withHint = false, showLabel = false }: { withHint?: boolean; showLabel?: boolean }) {
  const wedding = useWedding();
  const router = useRouter();
  const id = useId();
  const [on, setOn] = useState(!!wedding.showExamples);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => setOn(!!wedding.showExamples), [wedding.showExamples]);

  useEffect(() => {
    if (!withHint) return;
    try {
      if (!localStorage.getItem(hintKey(wedding.slug))) setHint(true);
    } catch {
      // private browsing: no hint, no harm
    }
  }, [withHint, wedding.slug]);

  // The note floats above the page (the header would otherwise clip it):
  // under the switch on bigger screens, in the middle of the screen on phones.
  useEffect(() => {
    if (!hint) return;
    const measure = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPlace({ top: r.bottom + 18, right: Math.max(8, window.innerWidth - r.right - 6) });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [hint]);

  function dismiss() {
    setHint(false);
    try {
      localStorage.setItem(hintKey(wedding.slug), "1");
    } catch {}
  }

  function flip(next: boolean) {
    setOn(next);
    setError(null);
    dismiss();
    start(async () => {
      const r = await setExamples(next);
      if (r.error) {
        setOn(!next);
        setError(r.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <span className="relative inline-flex items-center gap-2">
      {showLabel && (
        <label htmlFor={id} className="cursor-pointer font-serif text-[13px] text-ink-soft">
          Examples
        </label>
      )}
      <span ref={anchor} className="ball-switch" title={on ? "Hide the example plans" : "Show example plans"}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="ball-switch__input"
          checked={on}
          disabled={pending}
          onChange={(e) => flip(e.target.checked)}
          aria-label="Show example plans"
        />
        <span className="ball-switch__shade" aria-hidden="true" />
        <span className="ball-switch__ball" aria-hidden="true" />
      </span>
      {hint &&
        place &&
        createPortal(
        <div className="examples-hint-layer" style={{ "--hint-top": `${place.top}px`, "--hint-right": `${place.right}px` } as React.CSSProperties}>
        <span className="examples-hint" role="dialog" aria-label="Example plans">
          <svg className="examples-hint__arrow" viewBox="0 0 44 46" fill="none" aria-hidden="true">
            <path d="M8 44 C 6 26, 18 12, 34 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M25 4 L 35 7.5 L 29 16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {on ? (
            <>
              <b>Everything you see is an example.</b>
              Have a nose around: venues, comments, costs, winners, the lot. When you&rsquo;re ready for your own plans, roll
              the ball back and it all disappears.
            </>
          ) : (
            <>
              <b>Want a look around first?</b>
              Roll the ball and every page fills with an example wedding: venues, comments, costs, winners, the lot. Roll it
              back and it all disappears.
            </>
          )}
          <br />
          <button type="button" onClick={dismiss}>
            Got it
          </button>
        </span>
        </div>,
        document.body
        )}
      {error && (
        <span role="alert" className="absolute top-full right-0 mt-2 w-56 rounded-xl bg-alert px-3 py-2 font-serif text-[12px] text-white shadow-lg">
          {error}
        </span>
      )}
    </span>
  );
}
