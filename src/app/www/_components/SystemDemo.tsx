"use client";

import { useEffect, useRef, useState } from "react";

// The hero picture: one decision travelling through the whole site. An option
// is added, family vote and comment, a winner is chosen, its price lands in
// the budget, someone is given the job, and everyone hears about it. Every
// card moves on the same clock, so it reads as one system, not six features.

const STEPS = [
  "Add the options",
  "Family vote",
  "Pick the winner",
  "It lands in the budget",
  "Someone gets the job",
  "Everyone hears",
] as const;

const STEP_MS = 2300;

export function SystemDemo() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(STEPS.length - 1);
      return;
    }
    if (paused) return;
    const t = setInterval(() => setStep((s) => (s + 1) % (STEPS.length + 1)), STEP_MS);
    return () => clearInterval(t);
  }, [paused]);

  // Lean towards the pointer, a little.
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / r.width;
      const y = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.setProperty("--rx", `${(-y * 5).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(x * 7).toFixed(2)}deg`);
    };
    const reset = () => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", reset);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", reset);
    };
  }, []);

  const s = step; // 0..6, 6 = resting beat before the loop starts again
  const votes = s >= 1 ? (s === 1 ? 2 : 4) : 0;
  const chosen = s >= 2;
  const inBudget = s >= 3;
  const task = s >= 4;
  const sent = s >= 5;

  return (
    <div
      ref={root}
      className="ww-sys"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Example: choosing a venue on Weddings Weddings, from options to budget to messages"
      role="img"
    >
      <div className="ww-sys-stage">
        {/* the planning board */}
        <div className="ww-sys-card ww-sys-board" data-on={s >= 0}>
          <p className="ww-sys-kicker">
            <i style={{ background: "var(--w-sage)" }} /> Venue · 3 options
          </p>
          {[
            { name: "The Old Barn", price: "£8,400", v: Math.max(0, votes - 3) },
            { name: "Hill House", price: "£9,100", v: votes, win: true },
            { name: "Riverside Hall", price: "£7,250", v: votes > 2 ? 1 : 0 },
          ].map((o) => (
            <div
              key={o.name}
              className={`ww-sys-opt ${chosen ? (o.win ? "is-win" : "is-lose") : ""}`}
            >
              <span className="ww-sys-thumb" />
              <span className="ww-sys-optname">
                {o.name}
                <em>{o.price}</em>
              </span>
              <span className={`ww-sys-votes ${o.v ? "has" : ""}`}>♥ {o.v}</span>
              {o.win && <span className="ww-sys-crown" aria-hidden="true">Chosen</span>}
            </div>
          ))}
          <div className={`ww-sys-comment ${s === 1 || s === 2 ? "show" : ""}`}>
            <b>Mum</b> The gardens!! That&rsquo;s the one.
          </div>
        </div>

        {/* the budget */}
        <div className="ww-sys-card ww-sys-budget" data-on={inBudget}>
          <p className="ww-sys-kicker">
            <i style={{ background: "var(--w-gold)" }} /> Budget
          </p>
          <p className="ww-sys-total">
            <span>{inBudget ? "£14,960" : "£5,860"}</span> committed
          </p>
          <div className="ww-sys-bar">
            <span style={{ width: inBudget ? "62%" : "24%" }} />
          </div>
          <p className="ww-sys-line">
            Venue <b>{inBudget ? "£9,100" : "TBC"}</b>
          </p>
        </div>

        {/* the job */}
        <div className="ww-sys-card ww-sys-task" data-on={task}>
          <p className="ww-sys-kicker">
            <i style={{ background: "var(--w-blue)" }} /> Tasks
          </p>
          <p className="ww-sys-taskline">
            <span className={`ww-sys-tick ${s >= 5 ? "done" : ""}`} />
            Pay the venue deposit
          </p>
          <p className="ww-sys-who">
            <span className="ww-sys-avatar">N</span> Nick · due 12 May
          </p>
        </div>

        {/* the message */}
        <div className="ww-sys-card ww-sys-msg" data-on={sent}>
          <p className="ww-sys-kicker">
            <i style={{ background: "var(--w-teal)" }} /> Messages
          </p>
          <p className="ww-sys-msgline">&ldquo;We&rsquo;ve found our venue!&rdquo;</p>
          <p className="ww-sys-who">Sent to 112 guests · 9 replies</p>
        </div>
      </div>

      <ol className="ww-sys-steps">
        {STEPS.map((label, i) => (
          <li key={label} className={i === s ? "now" : i < s ? "done" : ""}>
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}
