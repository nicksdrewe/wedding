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
}: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    ref.current?.querySelectorAll<HTMLElement>(".gstar").forEach((s) => {
      s.setAttribute(
        "style",
        `--angle:${RANDOM(0, 360)};--duration:${RANDOM(6, 20)};--delay:${RANDOM(1, 10)};--alpha:${RANDOM(40, 90) / 100};--size:${RANDOM(2, 6)};--distance:${RANDOM(40, 200)};`
      );
    });
  }, []);
  return (
    <span className="galaxy-btn" ref={ref}>
      <button type={type} disabled={disabled} onClick={onClick}>
        <span className="gspark" />
        <span className="gbackdrop" />
        <span className="galaxy__container">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="gstar gstar--static" />
          ))}
        </span>
        <span className="galaxy">
          <span className="galaxy__ring">
            {Array.from({ length: 20 }, (_, i) => (
              <span key={i} className="gstar" />
            ))}
          </span>
        </span>
        <span className="gtext">{children}</span>
      </button>
    </span>
  );
}
