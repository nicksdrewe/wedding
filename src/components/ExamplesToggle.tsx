"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setExamples } from "@/lib/wedding/actions";
import { useWedding } from "@/components/WeddingProvider";

// The examples switch: fills every planning page with a made-up wedding plan
// so the couple can see how things work, and clears it all again. The first
// time the couple sees it, a little note points at it (remembered per
// browser, per wedding).

const hintKey = (slug: string) => `ww-examples-hint:${slug || "site"}`;

export function ExamplesToggle({ withHint = false, showLabel = false }: { withHint?: boolean; showLabel?: boolean }) {
  const wedding = useWedding();
  const router = useRouter();
  const id = useId();
  const [on, setOn] = useState(!!wedding.showExamples);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState(false);

  useEffect(() => setOn(!!wedding.showExamples), [wedding.showExamples]);

  useEffect(() => {
    if (!withHint) return;
    try {
      if (!localStorage.getItem(hintKey(wedding.slug))) setHint(true);
    } catch {
      // private browsing: no hint, no harm
    }
  }, [withHint, wedding.slug]);

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
      <span className="ball-switch" title={on ? "Hide the example plans" : "Show example plans"}>
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
      {hint && (
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
      )}
      {error && (
        <span role="alert" className="absolute top-full right-0 mt-2 w-56 rounded-xl bg-alert px-3 py-2 font-serif text-[12px] text-white shadow-lg">
          {error}
        </span>
      )}
    </span>
  );
}
