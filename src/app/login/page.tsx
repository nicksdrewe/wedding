"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Botanical } from "@/components/Botanical";

// Typed code rather than a clickable magic link: email security scanners
// (Gmail's especially) fetch links in a message before the recipient clicks,
// and the token is single-use — so the scanner consumed the sign-in and the
// real click always arrived with a spent token. A code has no URL to prefetch.
//
// Supabase's OTP length is configurable and currently returns 8 digits, so
// accept a range rather than pinning to one length.
const CODE_MIN = 6;
const CODE_MAX = 10;
const PENDING_EMAIL_KEY = "pending-signin-email";

type Track = "code" | "password";
type CodeStep = "email" | "verify";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/hub";

  const [track, setTrack] = useState<Track>("code");
  const [codeStep, setCodeStep] = useState<CodeStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PENDING_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setCodeStep("verify");
      }
    } catch {
      // storage unavailable (private mode) — start at step 1
    }
  }, []);

  function rememberEmail(value: string | null) {
    try {
      if (value) window.localStorage.setItem(PENDING_EMAIL_KEY, value);
      else window.localStorage.removeItem(PENDING_EMAIL_KEY);
    } catch {
      // non-fatal
    }
  }

  // Full page load rather than router.push() everywhere below: the client
  // router cache may still hold the signed-out render of the destination,
  // which would show a logged-out page immediately after a successful sign
  // in. A hard navigation guarantees the server re-renders with the session.
  function goToDestination() {
    window.location.assign(next);
  }

  function switchTrack(t: Track) {
    setTrack(t);
    setError(null);
    setNotice(null);
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error } = await createClient().auth.signInWithOtp({ email });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    rememberEmail(email);
    setCodeStep("verify");
    setNotice(`Code sent to ${email}. It can take a minute to arrive.`);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setBusy(false);
      setError("That code wasn't right, or it's expired. Try again.");
      return;
    }
    rememberEmail(null);
    goToDestination();
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      setError("Email or password wasn't right.");
      return;
    }
    goToDestination();
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <Botanical
        seed={7}
        stems={1}
        width={110}
        height={170}
        spread={8}
        strokeOpacity={0.7}
        fillOpacity={0.35}
        className="pointer-events-none absolute -top-2 -right-2"
      />

      <div className="relative z-10 w-full max-w-sm text-center">
        <p className="font-serif text-xs tracking-[0.25em] text-ink-soft uppercase">
          Nick &amp; Ellie
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">Sign in</h1>

        <div className="mx-auto mt-7 flex max-w-[220px] gap-0.5 rounded-full bg-cream-deep p-1">
          <button
            type="button"
            onClick={() => switchTrack("code")}
            className={`flex-1 rounded-full py-2 font-serif text-xs tracking-wide transition ${
              track === "code" ? "bg-ink text-cream" : "text-ink-soft"
            }`}
          >
            Code
          </button>
          <button
            type="button"
            onClick={() => switchTrack("password")}
            className={`flex-1 rounded-full py-2 font-serif text-xs tracking-wide transition ${
              track === "password" ? "bg-ink text-cream" : "text-ink-soft"
            }`}
          >
            Password
          </button>
        </div>

        {track === "code" && codeStep === "email" && (
          <>
            <p className="mt-6 font-reading text-[15px] text-ink-soft">
              Pop in your email and we&rsquo;ll send you a sign-in code.
            </p>
            <form onSubmit={sendCode} className="mt-6 flex flex-col gap-3">
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-full border border-ink/20 bg-white px-5 py-3.5 text-center font-reading text-[15px] text-ink outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-ink px-5 py-3.5 font-serif text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send my code"}
              </button>
              <button
                type="button"
                onClick={() => setCodeStep("verify")}
                className="mt-1 font-serif text-xs text-ink-soft underline"
              >
                I already have a code
              </button>
            </form>
          </>
        )}

        {track === "code" && codeStep === "verify" && (
          <>
            <p className="mt-6 font-reading text-[15px] text-ink-soft">
              Enter the code from your email.
            </p>
            <form onSubmit={verifyCode} className="mt-6 flex flex-col gap-3">
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-full border border-ink/20 bg-white px-5 py-3 text-center font-reading text-sm text-ink outline-none focus:border-accent"
              />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={CODE_MAX}
                placeholder="Your code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="rounded-full border border-ink/20 bg-white px-5 py-3.5 text-center font-serif text-2xl tracking-[0.3em] text-ink outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={busy || code.length < CODE_MIN || !email}
                className="rounded-full bg-ink px-5 py-3.5 font-serif text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
              >
                {busy ? "Signing you in…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => {
                  rememberEmail(null);
                  setCodeStep("email");
                  setCode("");
                  setError(null);
                  setNotice(null);
                }}
                className="mt-1 font-serif text-xs text-ink-soft underline"
              >
                Send a new code
              </button>
            </form>
          </>
        )}

        {track === "password" && (
          <>
            <p className="mt-6 font-reading text-[15px] text-ink-soft">
              Sign in with your email and password.
            </p>
            <form onSubmit={signInWithPassword} className="mt-6 flex flex-col gap-3">
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-full border border-ink/20 bg-white px-5 py-3.5 text-center font-reading text-[15px] text-ink outline-none focus:border-accent"
              />
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-full border border-ink/20 bg-white px-5 py-3.5 text-center font-reading text-[15px] text-ink outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-ink px-5 py-3.5 font-serif text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
              >
                {busy ? "Signing you in…" : "Sign in"}
              </button>
              <p className="mt-1 font-reading text-xs text-ink-soft italic">
                Haven&rsquo;t set a password yet? Sign in with a code first,
                then set one from your account page.
              </p>
            </form>
          </>
        )}

        {notice && <p className="mt-5 font-reading text-sm text-ink-soft">{notice}</p>}
        {error && <p className="mt-5 font-reading text-sm text-alert">{error}</p>}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
