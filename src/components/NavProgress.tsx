"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Clicking a link that has to load: the words on the thing you clicked turn
// into a pulsing galaxy (see loading.css) until the new page arrives, so it's
// obvious something is happening. Nothing else on the page changes.

const PENDING = "data-galaxy";

function clear() {
  document.querySelectorAll(`[${PENDING}]`).forEach((el) => el.removeAttribute(PENDING));
}

// Every element inside the link that holds its own words.
function textHolders(link: Element) {
  const holders: Element[] = [];
  for (const el of [link, ...Array.from(link.querySelectorAll("*"))]) {
    const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
    if (hasText) holders.push(el);
  }
  return holders;
}

export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const failsafe = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The new page arrived.
  useEffect(() => {
    clear();
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
      clear();
      const holders = textHolders(a);
      // A link with no words (a picture, an icon) pulses as a whole instead.
      (holders.length ? holders : [a]).forEach((el) => el.setAttribute(PENDING, holders.length ? "text" : "whole"));
      if (failsafe.current) clearTimeout(failsafe.current);
      failsafe.current = setTimeout(clear, 15000);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
