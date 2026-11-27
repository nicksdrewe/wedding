"use client";

import { useEffect, useRef } from "react";

// Small bits of life for the commercial pages. All of them stand still for
// people who ask for reduced motion, and do nothing on touch screens where
// there's no pointer to follow.

const still = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.matchMedia("(pointer: coarse)").matches);

/** A warm patch of light that follows the pointer around its parent. */
export function Sunlight() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host || still()) return;
    const move = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      el.style.setProperty("--x", `${e.clientX - r.left}px`);
      el.style.setProperty("--y", `${e.clientY - r.top}px`);
      el.style.opacity = "1";
    };
    const out = () => (el.style.opacity = "0");
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerleave", out);
    return () => {
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", out);
    };
  }, []);
  return <div ref={ref} className="ww-sun" aria-hidden="true" />;
}

/** Fades and lifts its children into place when they scroll into view. */
export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("is-in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`ww-reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Buttons and cards that lean a few pixels towards the pointer. */
export function Magnetic({ children, strength = 10 }: { children: React.ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || still()) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - (r.left + r.width / 2)) / r.width) * strength;
      const y = ((e.clientY - (r.top + r.height / 2)) / r.height) * strength;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    };
    const out = () => (el.style.transform = "");
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", out);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", out);
    };
  }, [strength]);
  return (
    <span ref={ref} className="ww-magnetic">
      {children}
    </span>
  );
}
