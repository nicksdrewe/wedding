"use client";

import { useEffect, useRef } from "react";

// The night garden (left) and the paper page (right) with a flower standing
// across the split. Purely decorative; the form is passed in as children.

const FLOWERS = [
  { x: "12%", h: "46%", bs: 64, bc: "#f0a9b4", gd: 0.2, sd: 0.4 },
  { x: "27%", h: "62%", bs: 84, bc: "#ecc566", gd: 0.7, sd: 1.2 },
  { x: "43%", h: "38%", bs: 58, bc: "#d3a6e2", gd: 1.2, sd: 2 },
  { x: "58%", h: "70%", bs: 96, bc: "#f0a9b4", gd: 0.5, sd: 0.8 },
  { x: "74%", h: "50%", bs: 70, bc: "#86d0cb", gd: 1.5, sd: 1.6 },
  { x: "88%", h: "58%", bs: 78, bc: "#ecc566", gd: 0.9, sd: 2.4 },
];

const HEART =
  "M23.6 2c-3.363 0-6.258 2.736-7.599 5.594-1.342-2.858-4.237-5.594-7.601-5.594-4.637 0-8.4 3.764-8.4 8.401 0 9.433 9.516 11.906 16.001 21.232 6.13-9.268 15.999-12.1 15.999-21.232 0-4.637-3.763-8.401-8.4-8.401z";
const HEARTS = [
  { l: "18%", s: 12, d: 12, dl: 2.5, x: 24, c: "#f0a9b4" },
  { l: "40%", s: 16, d: 14, dl: 4.5, x: -18, c: "#ecc566" },
  { l: "62%", s: 11, d: 11, dl: 3.2, x: 30, c: "#d3a6e2" },
  { l: "80%", s: 14, d: 13, dl: 6, x: -26, c: "#f0a9b4" },
];

// The frames of the landing page's blooming flower, played once on arrival.
// Every few frames, so the whole thing stays light.
const FRAMES = Array.from({ length: 18 }, (_, i) => 1 + i * 4);
const FRAME_SRC = (n: number) => `/hero-frames/frame-${String(n).padStart(4, "0")}.jpg`;

function Medallion() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 720;
    canvas.height = 720;
    const images: HTMLImageElement[] = [];
    let alive = true;
    let timer: number | undefined;
    let loaded = 0;
    const draw = (img: HTMLImageElement) => {
      // The flower sits in the middle of a wider picture: crop a square round it.
      const side = img.naturalHeight * 0.92;
      ctx.drawImage(img, img.naturalWidth / 2 - side / 2, img.naturalHeight * 0.04, side, side, 0, 0, 720, 720);
    };
    const play = () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let i = reduce ? images.length - 1 : 0;
      const step = () => {
        if (!alive) return;
        draw(images[i]);
        if (i < images.length - 1) {
          i += 1;
          timer = window.setTimeout(step, 95);
        }
      };
      step();
    };
    FRAMES.forEach((n, idx) => {
      const img = new Image();
      img.onload = () => {
        loaded += 1;
        if (idx === 0) draw(img);
        if (loaded === FRAMES.length) play();
      };
      img.src = FRAME_SRC(n);
      images[idx] = img;
    });
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}

export function AuthScene({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-stage">
      <div className="auth-night" aria-hidden="true">
        {Array.from({ length: 46 }, (_, i) => (
          <span
            key={i}
            className="auth-star"
            style={
              {
                left: `${(i * 37) % 100}%`,
                top: `${(i * 53) % 78}%`,
                "--tw": `${3 + (i % 5)}s`,
                "--td": `${(i % 7) * 0.6}s`,
              } as React.CSSProperties
            }
          />
        ))}
        {HEARTS.map((h, i) => (
          <svg
            key={i}
            viewBox="0 0 32 32"
            className="auth-heart"
            style={{ left: h.l, "--hs": `${h.s}px`, "--hd": `${h.d}s`, "--hdl": `${h.dl}s`, "--hx": `${h.x}px`, "--hc": h.c } as React.CSSProperties}
          >
            <path d={HEART} />
          </svg>
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            className="auth-firefly"
            style={
              {
                left: `${8 + i * 10}%`,
                bottom: `${12 + ((i * 17) % 40)}%`,
                "--fd": `${7 + (i % 4) * 2}s`,
                "--fdl": `${i * 0.9}s`,
                "--fx": `${(i % 2 ? 1 : -1) * (20 + i * 3)}px`,
                "--fy": `${-18 - (i % 3) * 10}px`,
              } as React.CSSProperties
            }
          />
        ))}
        <div className="auth-garden">
          {FLOWERS.map((f, i) => (
            <div
              key={i}
              className="auth-flower"
              style={{ "--x": f.x, "--h": f.h, "--gd": `${f.gd}s`, "--sd": `${f.sd}s`, "--bs": `${f.bs}px`, "--bc": f.bc } as React.CSSProperties}
            >
              <span className="auth-flower__stem" />
              <span className="auth-flower__leaf auth-flower__leaf--l" />
              <span className="auth-flower__leaf auth-flower__leaf--r" />
              <span className="auth-flower__bloom">
                {[0, 72, 144, 216, 288].map((r) => (
                  <span key={r} className="auth-flower__petal" style={{ "--r": `${r}deg` } as React.CSSProperties} />
                ))}
                <span className="auth-flower__core" />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-medallion-glow" aria-hidden="true" />
      <div className="auth-medallion">
        <Medallion />
      </div>

      <div className="auth-paper">{children}</div>
    </div>
  );
}
