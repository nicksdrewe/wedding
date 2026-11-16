"use client";

import { useEffect, useRef } from "react";

const RANDOM = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

// The cosmic button: stars orbit inside it and a galaxy swirls up on hover.
// Randomised after mount so the server and the browser agree on the markup.
export function GalaxyButton({
  children,
  disabled,
  type = "submit",
  onClick,
  power = 1,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
  // 0 to 1: how much of the full effect (stars, swirl, glow) this button has.
  power?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    ref.current?.querySelectorAll<HTMLElement>(".gstar").forEach((s) => {
      s.setAttribute(
        "style",
        `--angle:${RANDOM(0, 360)};--duration:${RANDOM(6, 20)};--delay:${RANDOM(1, 10)};--alpha:${RANDOM(40, 90) / 100};--size:${RANDOM(2, 6)};--distance:${RANDOM(40, 200)};`
      );
    });
  }, [power]);
  const ring = Math.max(3, Math.round(20 * power));
  const loose = Math.max(1, Math.round(4 * power));
  return (
    <span className="galaxy-btn" ref={ref} style={{ "--power": power } as React.CSSProperties}>
      <button type={type} disabled={disabled} onClick={onClick}>
        <span className="gspark" />
        <span className="gbackdrop" />
        <span className="galaxy__container">
          {Array.from({ length: loose }, (_, i) => (
            <span key={i} className="gstar gstar--static" />
          ))}
        </span>
        <span className="galaxy">
          <span className="galaxy__ring">
            {Array.from({ length: ring }, (_, i) => (
              <span key={i} className="gstar" />
            ))}
          </span>
        </span>
        <span className="gtext">{children}</span>
      </button>
    </span>
  );
}
