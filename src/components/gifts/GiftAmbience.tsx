import { Botanical } from "@/components/Botanical";

// Fixed, deterministic specks — no Math.random, so server and client render
// the same markup (no hydration mismatch) and the pattern is stable between
// visits. left = % across, size in px, dur/delay in seconds.
const SPECKS = [
  { left: 6, size: 3, dur: 26, delay: -4 },
  { left: 13, size: 2, dur: 32, delay: -19 },
  { left: 21, size: 4, dur: 28, delay: -11 },
  { left: 29, size: 2, dur: 36, delay: -27 },
  { left: 37, size: 3, dur: 30, delay: -8 },
  { left: 44, size: 2, dur: 34, delay: -22 },
  { left: 52, size: 4, dur: 27, delay: -15 },
  { left: 59, size: 2, dur: 38, delay: -3 },
  { left: 66, size: 3, dur: 31, delay: -24 },
  { left: 73, size: 2, dur: 35, delay: -13 },
  { left: 80, size: 4, dur: 29, delay: -9 },
  { left: 87, size: 3, dur: 33, delay: -29 },
  { left: 93, size: 2, dur: 37, delay: -17 },
];

// The page's slow, constant motion: two blurred sage glows drifting, a few
// botanical stems swaying from the page edges, and fine specks rising like
// light through a window. Everything is CSS-only and pointer-events-none,
// so it costs no JS and never gets in the way of the content; the global
// prefers-reduced-motion rule in globals.css stills all of it.
export function GiftAmbience() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full bg-accent/40 blur-[120px]"
        style={{ animation: "drift1 22s ease-in-out infinite" }}
      />
      <div
        className="absolute -right-40 bottom-0 h-[38rem] w-[38rem] rounded-full bg-accent-soft/25 blur-[130px]"
        style={{ animation: "drift2 28s ease-in-out infinite" }}
      />

      <div
        className="absolute bottom-[-30px] left-[-24px] origin-bottom"
        style={{ animation: "sway 9s ease-in-out infinite" }}
      >
        <Botanical
          seed={5}
          stems={3}
          width={230}
          height={380}
          spread={38}
          color="var(--color-cream)"
          strokeOpacity={0.24}
          fillOpacity={0.1}
        />
      </div>
      <div
        className="absolute right-[-18px] bottom-[-30px] origin-bottom"
        style={{ animation: "sway 11s ease-in-out infinite reverse" }}
      >
        <Botanical
          seed={23}
          stems={2}
          width={190}
          height={320}
          spread={26}
          color="var(--color-cream)"
          strokeOpacity={0.2}
          fillOpacity={0.08}
        />
      </div>
      <div
        className="absolute top-[-20px] right-[8%] origin-top hidden sm:block"
        style={{ animation: "swayTop 13s ease-in-out infinite" }}
      >
        <Botanical
          seed={41}
          stems={1}
          width={120}
          height={200}
          spread={14}
          color="var(--color-cream)"
          strokeOpacity={0.16}
          fillOpacity={0.07}
          style={{ transform: "rotate(180deg)" }}
        />
      </div>

      {SPECKS.map((s, i) => (
        <span
          key={i}
          className="absolute bottom-0 rounded-full bg-cream"
          style={{
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            opacity: 0,
            boxShadow: "0 0 10px 2px rgba(244,241,236,0.45)",
            animation: `riseFade ${s.dur}s linear ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
