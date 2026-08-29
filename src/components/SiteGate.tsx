"use client";

import { useEffect, useState } from "react";
import { Botanical } from "@/components/Botanical";

// A soft deterrent, not real security: purely client-side, checked against
// a shared code baked into the bundle. It stops a casual link-share or
// search-engine crawl from landing straight in the hero before they've even
// scrolled — it will not stop someone who opens devtools. Real access
// control still lives in Supabase auth/RLS for everything past the landing
// page.
const GATE_CODE = "N&E2028";
const GATE_STORAGE_KEY = "site-gate-unlocked";

type Status = "checking" | "locked" | "unlocked";

export function SiteGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);

  // Checked after mount, not during SSR — a returning visitor's unlock
  // lives only in their own browser's localStorage, which the server can't
  // see. Rendering nothing during that check avoids a locked-screen flash
  // for someone who's already unlocked it.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GATE_STORAGE_KEY);
      setStatus(stored === "true" ? "unlocked" : "locked");
    } catch {
      setStatus("locked");
    }
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim().toUpperCase() === GATE_CODE) {
      try {
        window.localStorage.setItem(GATE_STORAGE_KEY, "true");
      } catch {
        // private mode etc. — they'll just be asked again next visit
      }
      setStatus("unlocked");
      setWrong(false);
    } else {
      setWrong(true);
    }
  }

  if (status === "checking") {
    return <div className="h-screen w-full bg-ink" aria-hidden="true" />;
  }

  if (status === "unlocked") {
    return <>{children}</>;
  }

  return (
    <main className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-ink px-6 text-center">
      <Botanical
        seed={3}
        stems={2}
        width={150}
        height={220}
        spread={24}
        color="var(--color-cream)"
        strokeOpacity={0.22}
        fillOpacity={0.1}
        className="pointer-events-none absolute -bottom-10 -left-10"
      />
      <Botanical
        seed={17}
        stems={1}
        width={110}
        height={170}
        spread={10}
        color="var(--color-cream)"
        strokeOpacity={0.18}
        fillOpacity={0.08}
        className="pointer-events-none absolute -top-6 -right-6"
      />

      <p className="relative z-10 font-serif text-xs tracking-[0.3em] text-cream/60 uppercase">
        Nick &amp; Ellie
      </p>
      <h1 className="relative z-10 mt-3 font-display text-3xl text-cream">This one&rsquo;s private</h1>
      <p className="relative z-10 mt-3 max-w-xs font-reading text-sm text-cream/70 italic">
        Enter the code from your invitation to come in.
      </p>

      <form onSubmit={submit} className="relative z-10 mt-8 flex flex-col items-center gap-3">
        <input
          type="text"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setWrong(false);
          }}
          placeholder="Access code"
          className={`w-56 rounded-full border bg-white/10 px-5 py-3.5 text-center font-serif text-lg tracking-[0.2em] text-cream uppercase outline-none backdrop-blur-sm transition placeholder:text-cream/40 focus:border-cream/50 ${
            wrong ? "border-alert" : "border-cream/25"
          }`}
        />
        <button
          type="submit"
          className="rounded-full bg-cream px-8 py-3.5 font-serif text-sm text-ink transition hover:bg-white"
        >
          Enter
        </button>
        {wrong && (
          <p className="font-reading text-xs text-alert">That code isn&rsquo;t quite right.</p>
        )}
      </form>
    </main>
  );
}
