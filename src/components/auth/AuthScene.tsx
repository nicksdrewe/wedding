"use client";

// The night garden (left) and the paper page (right) with a flower standing
// across the split. Purely decorative; the form is passed in as children.

// Each flower has its own uneven set of petals (angle, length, width), so none
// is a perfect wheel. Colours are the site's own: sage, cream, dusky rose, soft gold.
type Petal = [number, number, number];
// Leaves: which side, how far up the stem (%), size, tilt. One to three per stem.
type Leaf = ["l" | "r", number, number, number];
const FLOWERS: { x: string; h: string; bs: number; bc: string; gd: number; sd: number; petals: Petal[]; leaves: Leaf[] }[] = [
  { x: "11%", h: "44%", bs: 58, bc: "#c98f9a", gd: 0.2, sd: 0.4, petals: [[-70, 0.9, 0.8], [-22, 1, 1], [30, 0.78, 0.9], [84, 0.95, 0.7]], leaves: [["l", 30, 1.1, -28], ["r", 52, 0.8, -12], ["l", 66, 0.7, -40]] },
  { x: "28%", h: "60%", bs: 76, bc: "#dcc489", gd: 0.7, sd: 1.2, petals: [[-95, 0.8, 0.9], [-48, 1, 0.8], [-4, 0.85, 1], [41, 1, 0.75], [96, 0.7, 0.9], [150, 0.6, 0.8]], leaves: [["r", 38, 1.3, -22]] },
  { x: "45%", h: "36%", bs: 52, bc: "#9cc4a4", gd: 1.2, sd: 2, petals: [[-40, 1, 0.9], [18, 0.8, 1], [76, 0.95, 0.8]], leaves: [["l", 44, 0.9, -34], ["l", 24, 1.2, -16]] },
  { x: "60%", h: "68%", bs: 88, bc: "#f1e9dc", gd: 0.5, sd: 0.8, petals: [[-100, 0.75, 0.85], [-58, 0.95, 0.9], [-12, 1, 0.8], [33, 0.82, 1], [78, 1, 0.7], [128, 0.7, 0.9], [-145, 0.6, 0.8]], leaves: [["r", 28, 1.2, -30], ["l", 46, 1, -10], ["r", 62, 0.7, -38]] },
  { x: "75%", h: "48%", bs: 62, bc: "#c98f9a", gd: 1.5, sd: 1.6, petals: [[-62, 1, 0.8], [-8, 0.8, 0.95], [47, 0.95, 0.85], [104, 0.7, 0.8]], leaves: [["l", 34, 1, -24], ["r", 58, 0.9, -34]] },
  { x: "89%", h: "56%", bs: 70, bc: "#9cc4a4", gd: 0.9, sd: 2.4, petals: [[-84, 0.85, 0.9], [-30, 1, 0.8], [22, 0.9, 1], [70, 0.75, 0.85], [118, 0.6, 0.9]], leaves: [["r", 30, 1.1, -14], ["r", 54, 0.8, -32], ["l", 42, 1.3, -26]] },
];

const HEART =
  "M23.6 2c-3.363 0-6.258 2.736-7.599 5.594-1.342-2.858-4.237-5.594-7.601-5.594-4.637 0-8.4 3.764-8.4 8.401 0 9.433 9.516 11.906 16.001 21.232 6.13-9.268 15.999-12.1 15.999-21.232 0-4.637-3.763-8.401-8.4-8.401z";
const HEARTS = [
  { l: "18%", s: 12, d: 12, dl: 2.5, x: 24, c: "#c98f9a" },
  { l: "40%", s: 16, d: 14, dl: 4.5, x: -18, c: "#dcc489" },
  { l: "62%", s: 11, d: 11, dl: 3.2, x: 30, c: "#9cc4a4" },
  { l: "80%", s: 14, d: 13, dl: 6, x: -26, c: "#c98f9a" },
];

export function AuthScene({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-stage">
      <div className="auth-night" aria-hidden="true">
        <div className="auth-sky auth-sky--day" />
        <div className="auth-sky auth-sky--sunset" />
        <div className="auth-sky auth-sky--dusk" />
        <div className="auth-sun" />
        <div className="auth-moon" />
        <div className="auth-stars">
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
        </div>
        <p className="auth-name">Nick &amp; Ellie</p>
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
        <div className="auth-stars">
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
        </div>
        <div className="auth-garden">
          {FLOWERS.map((f, i) => (
            <div
              key={i}
              className="auth-flower"
              style={{ "--x": f.x, "--h": f.h, "--gd": `${f.gd}s`, "--sd": `${f.sd}s`, "--bs": `${f.bs}px`, "--bc": f.bc } as React.CSSProperties}
            >
              <span className="auth-flower__stem" />
              {f.leaves.map(([side, at, size, tilt], li) => (
                <span
                  key={li}
                  className={`auth-flower__leaf auth-flower__leaf--${side}`}
                  style={{ "--at": `${at}%`, "--ls": size, "--lr": `${tilt}deg`, "--ld": `${li * 0.25}s` } as React.CSSProperties}
                />
              ))}
              <span className="auth-flower__bloom">
                {f.petals.map(([r, len, wid]) => (
                  <span key={r} className="auth-flower__petal" style={{ "--r": `${r}deg`, "--len": len, "--wid": wid } as React.CSSProperties} />
                ))}
                <span className="auth-flower__core" />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-paper">{children}</div>
    </div>
  );
}
