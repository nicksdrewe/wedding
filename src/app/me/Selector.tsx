"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MyWedding } from "@/lib/platform/mine";
import { setMyRsvp } from "@/lib/platform/me-actions";

type Card = MyWedding & { href: string; rsvpHref: string; inboxHref: string; tasksHref: string };

const ROLE: Record<string, string> = { couple: "Your wedding", wedding_party: "Wedding party", family: "Family", guest: "Guest" };

function daysTo(date: string | null) {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00`);
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

function when(iso: string | null) {
  if (!iso) return "Date to come";
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** Drifting petals that lean away from the pointer. */
function Sky({ mode }: { mode: "day" | "night" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0,
      h = 0,
      raf = 0;
    const mouse = { x: -999, y: -999 };
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => {
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const tones = mode === "day" ? ["#f3a7b8", "#f6c86b", "#ffffff", "#9fd8bd", "#ffd9e1"] : ["#f7c6d0", "#ffe3a3", "#bfe9d6", "#cfd8ff", "#ffffff"];
    const bits = Array.from({ length: Math.min(90, Math.round((w * h) / 16000)) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 1 + Math.random() * 3.2,
      vx: (Math.random() - 0.5) * 0.25,
      vy: 0.15 + Math.random() * 0.45,
      spin: Math.random() * Math.PI,
      tone: tones[Math.floor(Math.random() * tones.length)],
      tw: Math.random() * Math.PI * 2,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const b of bits) {
        const dx = b.x - mouse.x,
          dy = b.y - mouse.y,
          d2 = dx * dx + dy * dy;
        if (d2 < 140 * 140) {
          const f = (1 - Math.sqrt(d2) / 140) * 1.6;
          b.x += (dx / Math.sqrt(d2 + 1)) * f;
          b.y += (dy / Math.sqrt(d2 + 1)) * f;
        }
        b.x += b.vx + Math.sin(b.spin) * 0.3;
        b.y += b.vy;
        b.spin += 0.01;
        b.tw += 0.03;
        if (b.y > h + 10) (b.y = -10), (b.x = Math.random() * w);
        if (b.x < -10) b.x = w + 10;
        if (b.x > w + 10) b.x = -10;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.spin);
        ctx.globalAlpha = 0.35 + Math.sin(b.tw) * 0.25;
        ctx.fillStyle = b.tone;
        ctx.shadowColor = b.tone;
        ctx.shadowBlur = mode === "day" ? 3.6 : 7.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, b.r * 1.6, b.r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (!still) raf = requestAnimationFrame(draw);
    };
    draw();
    const move = (e: PointerEvent) => ((mouse.x = e.clientX), (mouse.y = e.clientY));
    window.addEventListener("pointermove", move);
    window.addEventListener("resize", size);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("resize", size);
    };
  }, [mode]);
  return <canvas ref={ref} className="me-sky" aria-hidden="true" />;
}

/** Tilts toward the pointer, with a moving shine. */
function Tilt({ children, className, style, index }: { children: React.ReactNode; className: string; style?: React.CSSProperties; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(py - 0.5) * 3.5}deg`);
    el.style.setProperty("--ry", `${(0.5 - px) * 4.5}deg`);
    el.style.setProperty("--gx", `${px * 100}%`);
    el.style.setProperty("--gy", `${py * 100}%`);
  };
  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };
  return (
    <div ref={ref} className={className} style={{ ...style, animationDelay: `${180 + index * 110}ms` }} onPointerMove={onMove} onPointerLeave={reset}>
      {children}
    </div>
  );
}

function Countdown({ days, accent }: { days: number | null; accent: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (days === null || days < 0) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 1400);
      setShown(Math.round(days * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [days]);
  if (days === null) return null;
  const R = 34,
    C = 2 * Math.PI * R;
  // a full ring is a year or more away; it fills as the day gets closer
  const fill = days <= 0 ? 1 : Math.max(0.04, 1 - Math.min(days, 365) / 365);
  return (
    <div className="me-count" aria-label={days > 0 ? `${days} days to go` : days === 0 ? "Today" : "Married"}>
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r={R} className="me-count-track" />
        <circle cx="40" cy="40" r={R} className="me-count-ring" stroke={accent} strokeDasharray={`${C * fill} ${C}`} style={{ filter: `drop-shadow(0 0 5.4px ${accent})` }} />
      </svg>
      <span>
        <b>{days > 0 ? shown : days === 0 ? "♥" : "✓"}</b>
        <small>{days > 0 ? (days === 1 ? "day" : "days") : days === 0 ? "today" : "married"}</small>
      </span>
    </div>
  );
}

function RsvpSwitch({ weddingId, event }: { weddingId: string; event: MyWedding["events"][number] }) {
  const router = useRouter();
  const [value, setValue] = useState(event.attending);
  const [pending, start] = useTransition();
  const [err, setErr] = useState(false);
  const pick = (attending: boolean) =>
    start(async () => {
      const before = value;
      setValue(attending);
      setErr(false);
      const r = await setMyRsvp({ weddingId, eventId: event.id, attending });
      if (!r.ok) {
        setValue(before);
        setErr(true);
      } else router.refresh();
    });
  return (
    <div className="me-event">
      <div className="me-event-text">
        <b>{event.name}</b>
        <span>
          {when(event.startsAt)}
          {event.location ? ` · ${event.location}` : ""}
        </span>
      </div>
      <div className={`me-rsvp ${value === true ? "yes" : value === false ? "no" : ""} ${pending ? "busy" : ""}`} role="group" aria-label={`Your reply for ${event.name}`}>
        <i aria-hidden="true" />
        <button type="button" aria-pressed={value === true} onClick={() => pick(true)} disabled={pending}>
          Going
        </button>
        <button type="button" aria-pressed={value === false} onClick={() => pick(false)} disabled={pending}>
          Can&rsquo;t
        </button>
      </div>
      {err && <span className="me-err">Didn&rsquo;t save. Try again.</span>}
    </div>
  );
}

export function Selector({ weddings, owner, email }: { weddings: Card[]; owner: boolean; email: string | null }) {
  const [leaving, setLeaving] = useState<string | null>(null);
  const [mode, setMode] = useState<"day" | "night">("night");
  useEffect(() => {
    let m: "day" | "night" = new Date().getHours() >= 7 && new Date().getHours() < 19 ? "day" : "night";
    try {
      const saved = localStorage.getItem("me-sky");
      if (saved === "day" || saved === "night") m = saved;
    } catch {}
    setMode(m);
  }, []);
  // Where the moon sits behind the heading: the part of each letter in front of
  // it is drawn in dark parchment (see .me-mask), so pale words stay readable.
  const moonRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    const moon = moonRef.current;
    if (!root || !moon) return;
    // Every frame at night, so the dark patch stays on the moon however the page
    // moves: rubber-band overscroll, phone toolbars sliding, the title's tilt.
    let last = "";
    const place = () => {
      const m = moon.getBoundingClientRect();
      const cx = m.left + m.width / 2;
      const cy = m.top + m.height / 2;
      const els = root.querySelectorAll<HTMLElement>(".me-mask");
      const rects = [...els].map((el) => el.getBoundingClientRect());
      const key = `${cx},${cy},${m.width},${rects.map((r) => `${r.left},${r.top}`).join(",")}`;
      if (key === last) return;
      last = key;
      els.forEach((el, i) => {
        el.style.setProperty("--mx", `${cx - rects[i].left}px`);
        el.style.setProperty("--my", `${cy - rects[i].top}px`);
        el.style.setProperty("--mr", `${m.width / 2 + 1}px`);
      });
    };
    let raf = 0;
    const until = performance.now() + 2200;
    const loop = () => {
      place();
      if (mode === "night" || performance.now() < until) raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const flip = () => {
    const next = mode === "day" ? "night" : "day";
    setMode(next);
    try {
      localStorage.setItem("me-sky", next);
    } catch {}
  };
  const go = (href: string, id: string) => {
    setLeaving(id);
    setTimeout(() => (window.location.href = href), 420);
  };

  // number keys jump straight in
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= weddings.length) go(weddings[n - 1].href, weddings[n - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [weddings]);

  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const waiting = weddings.reduce((n, w) => n + w.events.filter((e) => e.attending === null).length + (w.couple?.unread ?? 0), 0);

  return (
    <div ref={rootRef} className={`me ${leaving ? "is-leaving" : ""}`} data-sky={mode}>
      <div className="me-skies" aria-hidden="true">
        <div className="me-sky-layer day" />
        <div className="me-sky-layer dusk" />
        <div className="me-sky-layer night" />
        <div className="me-sun" />
        <div className="me-moon" ref={moonRef} />
      </div>
      <Sky mode={mode} />
      <div className="me-aurora" aria-hidden="true" />
      <button type="button" className="me-mode" onClick={flip} aria-label={mode === "day" ? "Switch to night" : "Switch to day"} title={mode === "day" ? "Night" : "Day"}>
        <span className="me-mode-track" aria-hidden="true">
          <span className="me-mode-stars" />
          <span className="me-mode-knob" />
        </span>
      </button>
      <header className="me-head">
        <p className="me-eyebrow me-mask">{hello}</p>
        <h1 className="me-title">
          <span className="me-mask">Your</span> <em className="me-mask">weddings</em>
        </h1>
        <p className="me-sub me-mask">
          {weddings.length === 0
            ? "You're not on any wedding's list yet. When a couple adds you, it'll appear here."
            : `${weddings.length} ${weddings.length === 1 ? "wedding" : "weddings"}${waiting ? `, and ${waiting} thing${waiting === 1 ? "" : "s"} waiting for you` : ", and nothing waiting on you"}.`}
          {weddings.length > 1 && <span className="me-keys"> Press 1–{Math.min(9, weddings.length)} to jump in.</span>}
        </p>
      </header>

      <main className="me-grid">
        {weddings.map((w, i) => {
          const days = daysTo(w.date);
          const unanswered = w.events.filter((e) => e.attending === null).length;
          return (
            <Tilt
              key={w.id}
              index={i}
              className={`me-card ${leaving === w.id ? "is-chosen" : ""}`}
              style={{ "--ink": w.colours.ink, "--ground": w.colours.ground, "--accent": w.colours.accent } as React.CSSProperties}
            >
              <div className="me-card-shine" aria-hidden="true" />
              <div className="me-card-top">
                <div>
                  <span className="me-role">{ROLE[w.role] ?? w.role}</span>
                  <h2>{w.name}</h2>
                  <p className="me-date">
                    {w.date ? new Date(`${w.date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : (w.dateLabel ?? "Date to be set")}
                  </p>
                </div>
                <Countdown days={days} accent={w.colours.accent} />
              </div>

              <div className="me-chips">
                {w.couple && (
                  <>
                    <a href={w.inboxHref} className={`me-chip ${w.couple.unread ? "hot" : ""}`}>
                      <b>{w.couple.unread}</b> unread {w.couple.unread === 1 ? "reply" : "replies"}
                    </a>
                    <a href={w.tasksHref} className="me-chip">
                      <b>{w.couple.openTasks}</b> open tasks
                    </a>
                    <span className="me-chip">
                      <b>{w.couple.attending}</b> coming · <b>{w.couple.awaiting}</b> to reply
                    </span>
                  </>
                )}
                {!w.couple && w.myTasks > 0 && (
                  <a href={w.tasksHref} className="me-chip hot">
                    <b>{w.myTasks}</b> {w.myTasks === 1 ? "job" : "jobs"} for you
                  </a>
                )}
                {unanswered > 0 && (
                  <span className="me-chip hot">
                    <b>{unanswered}</b> to answer
                  </span>
                )}
              </div>

              {w.events.length > 0 && (
                <section className="me-section">
                  <h3>
                    Coming up
                    <a href={w.rsvpHref}>Full reply ↗</a>
                  </h3>
                  {w.events.map((e) => (
                    <RsvpSwitch key={e.id} weddingId={w.id} event={e} />
                  ))}
                </section>
              )}

              {w.notices.length > 0 && (
                <section className="me-section">
                  <h3>Latest messages</h3>
                  <ul className="me-notices">
                    {w.notices.map((n) => (
                      <li key={n.id}>
                        <span>{n.title}</span>
                        <time>{new Date(n.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</time>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <button type="button" className="me-enter" onClick={() => go(w.href, w.id)}>
                <span>Enter {w.name}</span>
                <span className="me-enter-arrow" aria-hidden="true">
                  →
                </span>
                {weddings.length > 1 && i < 9 && <kbd>{i + 1}</kbd>}
              </button>
            </Tilt>
          );
        })}

        {owner && (
          <Tilt index={weddings.length} className={`me-card me-owner ${leaving === "owner" ? "is-chosen" : ""}`}>
            <div className="me-card-shine" aria-hidden="true" />
            <div className="me-card-top">
              <div>
                <span className="me-role">Site owner</span>
                <h2>Control room</h2>
                <p className="me-date">Every wedding, newsletters, marketing and the front page&rsquo;s words.</p>
              </div>
              <div className="me-owner-pulse" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="me-bars" aria-hidden="true">
              {[38, 62, 45, 80, 58, 92, 70].map((h, i) => (
                <i key={i} style={{ height: `${h}%`, animationDelay: `${600 + i * 80}ms` }} />
              ))}
            </div>
            <button type="button" className="me-enter" onClick={() => go("/platform", "owner")}>
              <span>Open the control room</span>
              <span className="me-enter-arrow" aria-hidden="true">
                →
              </span>
            </button>
          </Tilt>
        )}
      </main>

      <footer className="me-foot">
        <span>Signed in as {email}</span>
        <a href="/logout">Sign out</a>
      </footer>
    </div>
  );
}
