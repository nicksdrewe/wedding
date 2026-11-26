"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";
import { Botanical } from "@/components/Botanical";
import { GalaxyButton } from "@/components/auth/GalaxyButton";
import { useWedding } from "@/components/WeddingProvider";
import { checkGateCode } from "@/lib/gate/actions";

// A gentle front door: each wedding can set its own access code (or none) in
// settings. The code is checked by the server, so it never sits in the page.
// Real access control still lives in Supabase auth/RLS for everything past the
// landing page.
//
// Exported so /i/[token]'s InviteRedirect can unlock the gate the same way
// entering the code does. Remembered per wedding.
export const GATE_STORAGE_KEY = "site-gate-unlocked";
export const gateStorageKey = (slug: string) => (slug && slug !== "nickellie" ? `${GATE_STORAGE_KEY}:${slug}` : GATE_STORAGE_KEY);

type Status = "checking" | "locked" | "unlocked";

export function SiteGate({ children, enabled = true }: { children: React.ReactNode; enabled?: boolean }) {
  const wedding = useWedding();
  const key = gateStorageKey(wedding.slug);
  const [status, setStatus] = useState<Status>("checking");
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);

  // Checked after mount, not during SSR — a returning visitor's unlock
  // lives only in their own browser's localStorage, which the server can't
  // see. Rendering nothing during that check avoids a locked-screen flash
  // for someone who's already unlocked it.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      setStatus(!enabled || stored === "true" ? "unlocked" : "locked");
    } catch {
      setStatus("locked");
    }
  }, [enabled, key]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (await checkGateCode(value.trim())) {
      try {
        window.localStorage.setItem(key, "true");
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
        {wedding.displayName}
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
