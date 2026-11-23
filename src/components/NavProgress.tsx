"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// The moment someone taps a link to another page, the words "Loading" appear
// in a drifting galaxy (text only, no box) so the site never looks stuck. It
// disappears as soon as the new page has arrived.

export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [busy, setBusy] = useState(false);
  const here = useRef(`${pathname}?${search}`);
  const failsafe = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The new page arrived.
  useEffect(() => {
    here.current = `${pathname}?${search}`;
    setBusy(false);
    if (failsafe.current) clearTimeout(failsafe.current);
  }, [pathname, search]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (url.pathname === window.location.pathname && url.hash) return;
      setBusy(true);
      if (failsafe.current) clearTimeout(failsafe.current);
      failsafe.current = setTimeout(() => setBusy(false), 12000);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!busy) return null;
  return (
    <div className="nav-loading" role="status" aria-live="polite">
      <span className="nav-loading__word" data-text="Loading">Loading</span>
    </div>
  );
}
