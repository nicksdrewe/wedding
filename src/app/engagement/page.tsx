"use client";

import { useState } from "react";
import { Botanical } from "@/components/Botanical";

export default function EngagementPartyPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [attending, setAttending] = useState<boolean | null>(null);
  const [plusOne, setPlusOne] = useState(false);
  const [plusOneName, setPlusOneName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (attending === null) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/engagement-rsvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        attending,
        plusOneAttending: plusOne,
        plusOneName,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Something went wrong — try again.");
      return;
    }
    setDone(true);
  }

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden px-6 py-16">
      <Botanical
        seed={11}
        stems={2}
        width={140}
        height={210}
        spread={30}
        strokeOpacity={0.7}
        fillOpacity={0.35}
        className="pointer-events-none absolute -top-4 -right-6"
      />

      <p className="relative z-10 font-serif text-xs tracking-[0.25em] text-ink-soft uppercase">
        Nick &amp; Ellie
      </p>
      <h1 className="relative z-10 mt-3 font-display text-[40px] tracking-tight">
        Engagement Party
      </h1>
      <p className="relative z-10 mt-3 max-w-md text-center font-reading text-[17px] text-ink-soft italic">
        Before the wedding itself, we&rsquo;d love to celebrate the
        engagement with anyone who can make it — no formal invite needed,
        just let us know you&rsquo;re coming.
      </p>

      <div className="relative z-10 mt-8 grid w-full max-w-lg grid-cols-2 gap-4 rounded-2xl border border-ink/10 bg-white p-6 text-left font-reading text-sm text-ink-soft">
        <div>
          <p className="font-serif text-xs tracking-[0.2em] text-ink-soft/70 uppercase">Date</p>
          <p className="mt-1 text-ink">To be confirmed</p>
        </div>
        <div>
          <p className="font-serif text-xs tracking-[0.2em] text-ink-soft/70 uppercase">Where</p>
          <p className="mt-1 text-ink">To be confirmed</p>
        </div>
      </div>

      <div className="relative z-10 mt-10 w-full max-w-lg">
        {done ? (
          <div
            className="rounded-2xl border border-ink/10 bg-white p-8 text-center"
            style={{ animation: "fadeUp 550ms cubic-bezier(0.22,1,0.36,1) both" }}
          >
            <h2 className="font-display text-2xl">
              {attending ? "Wonderful — see you there!" : "Thanks for letting us know"}
            </h2>
            <p className="mt-3 font-reading text-ink-soft">
              {attending
                ? "We've got you down. Details on timing and venue will follow closer to the date."
                : "We'll miss you, but thanks for the reply."}
            </p>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="rounded-2xl border border-ink/10 bg-white p-8"
            style={{ animation: "fadeUp 550ms cubic-bezier(0.22,1,0.36,1) both" }}
          >
            <h2 className="font-display text-[19px]">Let us know you&rsquo;re coming</h2>

            <div className="mt-5 flex flex-col gap-2.5">
              <input
                type="text"
                required
                autoComplete="name"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-full border border-ink/20 bg-white px-4.5 py-3 font-reading text-sm outline-none focus:border-accent"
              />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-full border border-ink/20 bg-white px-4.5 py-3 font-reading text-sm outline-none focus:border-accent"
              />
            </div>

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setAttending(true)}
                aria-pressed={attending === true}
                className={`flex-1 rounded-full py-3 font-serif text-[13px] transition ${
                  attending === true
                    ? "bg-accent text-cream"
                    : "border border-ink/20 text-ink-soft hover:border-ink/40"
                }`}
              >
                Joyfully attending
              </button>
              <button
                type="button"
                onClick={() => setAttending(false)}
                aria-pressed={attending === false}
                className={`flex-1 rounded-full py-3 font-serif text-[13px] transition ${
                  attending === false
                    ? "bg-ink text-cream"
                    : "border border-ink/20 text-ink-soft hover:border-ink/40"
                }`}
              >
                Can&rsquo;t make it
              </button>
            </div>

            {attending && (
              <div className="mt-5 flex flex-col gap-2.5">
                <label className="flex items-center gap-2.5 font-serif text-[13px] text-ink-soft">
                  <input
                    type="checkbox"
                    checked={plusOne}
                    onChange={(e) => setPlusOne(e.target.checked)}
                  />
                  Bringing a plus one
                </label>
                {plusOne && (
                  <input
                    type="text"
                    placeholder="Plus one's name"
                    value={plusOneName}
                    onChange={(e) => setPlusOneName(e.target.value)}
                    className="w-full rounded-full border border-ink/20 bg-white px-4.5 py-3 font-reading text-sm outline-none focus:border-accent"
                  />
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || attending === null}
              className="mt-6 w-full rounded-full bg-ink px-7 py-3.5 font-serif text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send RSVP"}
            </button>

            {error && <p className="mt-4 text-center font-reading text-sm text-alert">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
