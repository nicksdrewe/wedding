"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";
import { Botanical } from "@/components/Botanical";
import { GalaxyButton } from "@/components/auth/GalaxyButton";

// A soft deterrent, not real security: purely client-side, checked against
// a shared code baked into the bundle. It stops a casual link-share or
// search-engine crawl from landing straight in the hero before they've even
// scrolled — it will not stop someone who opens devtools. Real access
// control still lives in Supabase auth/RLS for everything past the landing
// page.
const GATE_CODES = ["N&E2028", "9762"];
// Exported so /i/[token]'s InviteRedirect can unlock the gate the same way
// entering the code does, without duplicating the key as a second string
// literal that could silently drift out of sync with this one.
export const GATE_STORAGE_KEY = "site-gate-unlocked";

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
    if (GATE_CODES.includes(value.trim().toUpperCase())) {
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
    return <div className="h-screen w-full bg-cream" aria-hidden="true" />;
  }

  if (status === "unlocked") {
    return <>{children}</>;
  }

  return (
    <main className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-cream px-6 text-center">
      <Botanical
        seed={3}
        stems={2}
        width={150}
        height={220}
        spread={24}
        color="var(--sec)"
        strokeOpacity={0.3}
        fillOpacity={0.14}
        className="pointer-events-none absolute -bottom-10 -left-10"
      />
      <Botanical
        seed={17}
        stems={1}
        width={110}
        height={170}
        spread={10}
        color="var(--sec)"
        strokeOpacity={0.24}
        fillOpacity={0.1}
        className="pointer-events-none absolute -top-6 -right-6"
      />

      <span className="relative z-10 mb-4 opacity-90">
        <LogoMark size={56} />
      </span>
      <p className="relative z-10 font-ui text-[11px] font-semibold tracking-[0.3em] text-ink-soft uppercase">
        Nick &amp; Ellie
      </p>
      <h1 className="relative z-10 mt-3 font-title text-4xl font-medium text-forest">This one&rsquo;s private</h1>
      <p className="relative z-10 mt-3 max-w-xs font-reading text-sm text-ink-soft italic">
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
          className={`w-56 rounded-full border bg-paper px-5 py-3.5 text-center font-serif text-lg tracking-[0.2em] text-ink uppercase outline-none transition placeholder:text-ink-soft/50 focus:border-[var(--sec)] ${
            wrong ? "border-alert" : "border-ink/15"
          }`}
        />
        {/* The same cosmic button as the sign-in page, in the site's forest green. */}
        <div
          className="w-56"
          style={{ "--sun-c": "#f4f1ec", "--btn-base": "#1d2a21", "--btn-sheen": "#4c6b52" } as React.CSSProperties}
        >
          <GalaxyButton>Enter</GalaxyButton>
        </div>
        <Link
          href="/login"
          className="mt-1 w-56 rounded-full border border-ink/15 px-6 py-3 font-ui text-sm text-ink-soft transition hover:border-ink/35 hover:text-ink"
        >
          Log in
        </Link>
        {wrong && (
          <p className="font-reading text-xs text-alert">That code isn&rsquo;t quite right.</p>
        )}
      </form>
    </main>
  );
}
