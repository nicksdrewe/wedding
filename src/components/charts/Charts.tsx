"use client";

import { useEffect, useRef, useState } from "react";

// Animated charts for the owner's console. Plain SVG/CSS (no chart library):
// they play their entrance when scrolled into view and answer the pointer.

function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, seen };
}

/** A number that counts up when it comes into view. */
export function CountUp({ value, prefix = "", duration = 1400 }: { value: number; prefix?: string; duration?: number }) {
  const { ref, seen } = useInView<HTMLSpanElement>();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!seen) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setN(Math.round(value * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, value, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {n.toLocaleString("en-GB")}
    </span>
  );
}

/** Columns that rise into place, coloured by height (rose, amber, green). */
export function BarChart({ data, height = 240, unit = "" }: { data: { label: string; value: number }[]; height?: number; unit?: string }) {
  const { ref, seen } = useInView<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = Math.ceil(max / 4) * 4 || 4;
  return (
    <div ref={ref} className="pc-bars" style={{ "--h": `${height}px` } as React.CSSProperties}>
      <div className="pc-bars-y" aria-hidden="true">
        {[4, 3, 2, 1, 0].map((i) => (
          <span key={i}>{Math.round((nice * i) / 4)}</span>
        ))}
      </div>
      <div className="pc-bars-plot" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {[1, 2, 3, 4].map((i) => (
          <i key={i} className="pc-grid" style={{ bottom: `${(i / 4) * 100}%` }} aria-hidden="true" />
        ))}
        {data.map((d, i) => (
          <div
            key={d.label + i}
            className={`pc-bar-col ${hover === i ? "is-hover" : ""}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div
              className={`pc-bar ${seen ? "in" : ""}`}
              style={{ height: `${(d.value / nice) * 100}%`, animationDelay: `${i * 55}ms`, backgroundSize: `100% var(--h)` }}
              aria-label={`${d.label}: ${d.value}${unit}`}
              role="img"
            >
              {hover === i && (
                <span className="pc-tip">
                  <b>{d.value.toLocaleString("en-GB")}</b>
                  {unit} · {d.label}
                </span>
              )}
            </div>
            <span className="pc-x">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Lines that draw themselves, with a soft glow fill beneath. */
export function LineChart({
  labels,
  series,
  height = 220,
}: {
  labels: string[];
  series: { name: string; values: number[]; colour: string }[];
  height?: number;
}) {
  const { ref, seen } = useInView<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = height;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const x = (i: number) => (labels.length <= 1 ? W / 2 : (i / (labels.length - 1)) * (W - 20) + 10);
  const y = (v: number) => H - 18 - (v / max) * (H - 40);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <div ref={ref} className="pc-line">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
        <defs>
          {series.map((s, si) => (
            <linearGradient key={si} id={`pcg${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.colour} stopOpacity="0.35" />
              <stop offset="100%" stopColor={s.colour} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="pc-line-grid" />
        ))}
        {series.map((s, si) => (
          <g key={s.name}>
            <path
              d={`${path(s.values)} L${x(s.values.length - 1)},${H} L${x(0)},${H} Z`}
              fill={`url(#pcg${si})`}
              className={`pc-area ${seen ? "in" : ""}`}
              style={{ animationDelay: `${300 + si * 200}ms` }}
            />
            <path
              d={path(s.values)}
              fill="none"
              stroke={s.colour}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className={`pc-stroke ${seen ? "in" : ""}`}
              style={{ animationDelay: `${si * 200}ms`, filter: `drop-shadow(0 0 6px ${s.colour})` }}
            />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 6 : 0} fill={s.colour} stroke="#0f1218" strokeWidth="2" className="pc-dot" />
            ))}
          </g>
        ))}
        {labels.map((_, i) => (
          <rect key={i} x={x(i) - W / labels.length / 2} y="0" width={W / labels.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      <div className="pc-line-x" aria-hidden="true">
        {labels.map((l, i) => (
          <span key={i} className={i % 2 ? "odd" : ""}>
            {l}
          </span>
        ))}
      </div>
      {hover !== null && (
        <div className="pc-line-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <b>{labels[hover]}</b>
          {series.map((s) => (
            <span key={s.name}>
              <i style={{ background: s.colour }} /> {s.name}: {s.values[hover].toLocaleString("en-GB")}
            </span>
          ))}
        </div>
      )}
      <div className="pc-legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.colour, boxShadow: `0 0 8px ${s.colour}` }} /> {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A ring that fills segment by segment, total in the middle. */
export function Donut({ segments, label }: { segments: { label: string; value: number; tone: string }[]; label: string }) {
  const { ref, seen } = useInView<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  const R = 70;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div ref={ref} className="pc-donut">
      <svg viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={R} className="pc-donut-track" />
        {segments.map((s, i) => {
          const len = (s.value / total) * C;
          const el = (
            <circle
              key={s.label}
              cx="90"
              cy="90"
              r={R}
              stroke={s.tone}
              strokeDasharray={`${seen ? Math.max(0, len - 2.5) : 0} ${C}`}
              strokeDashoffset={-offset}
              className={`pc-donut-seg ${hover === i ? "is-hover" : ""}`}
              style={{ transitionDelay: `${i * 180}ms`, filter: `drop-shadow(0 0 6px ${s.tone})` }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="pc-donut-mid">
        <b>{hover === null ? <CountUp value={segments.reduce((s, x) => s + x.value, 0)} /> : segments[hover].value}</b>
        <span>{hover === null ? label : segments[hover].label}</span>
      </div>
      <ul className="pc-donut-legend">
        {segments.map((s, i) => (
          <li key={s.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <i style={{ background: s.tone }} /> {s.label} <b>{s.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
