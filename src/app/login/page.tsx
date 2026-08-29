"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

type Mode = "code-email" | "code-verify" | "password";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/hub";

  const [mode, setMode] = useState<Mode>("code-email");
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
        setMode("code-verify");
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
    setMode("code-verify");
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
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-script text-4xl">Sign in</h1>

        {mode === "code-email" && (
          <>
            <p className="mt-2 font-serif text-ink-soft">
              Pop in your email and we&rsquo;ll send you a sign-in code.
            </p>
            <form onSubmit={sendCode} className="mt-8 flex flex-col gap-3">
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-full border border-ink/20 bg-cream px-5 py-3 text-center font-serif text-ink outline-none focus:border-ink"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-ink px-5 py-3 font-serif text-cream transition hover:bg-ink-soft disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send my code"}
              </button>
              <div className="mt-1 flex justify-center gap-4 text-sm">
                <button
                  type="button"
                  onClick={() => setMode("code-verify")}
                  className="font-serif text-ink-soft underline"
                >
                  I already have a code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setNotice(null);
                    setMode("password");
                  }}
                  className="font-serif text-ink-soft underline"
                >
                  Use a password instead
                </button>
              </div>
            </form>
          </>
        )}

        {mode === "code-verify" && (
          <>
            <p className="mt-2 font-serif text-ink-soft">
              Enter the code from your email.
            </p>
            <form onSubmit={verifyCode} className="mt-8 flex flex-col gap-3">
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-full border border-ink/20 bg-cream px-5 py-3 text-center font-serif text-sm text-ink outline-none focus:border-ink"
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
                className="rounded-full border border-ink/20 bg-cream px-5 py-3 text-center font-serif text-2xl tracking-[0.3em] text-ink outline-none focus:border-ink"
              />
              <button
                type="submit"
                disabled={busy || code.length < CODE_MIN || !email}
                className="rounded-full bg-ink px-5 py-3 font-serif text-cream transition hover:bg-ink-soft disabled:opacity-60"
              >
                {busy ? "Signing you in…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => {
                  rememberEmail(null);
                  setMode("code-email");
                  setCode("");
                  setError(null);
                  setNotice(null);
                }}
                className="font-serif text-sm text-ink-soft underline"
              >
                Send a new code
              </button>
            </form>
          </>
        )}

        {mode === "password" && (
          <>
            <p className="mt-2 font-serif text-ink-soft">
              Sign in with your email and password.
            </p>
            <form onSubmit={signInWithPassword} className="mt-8 flex flex-col gap-3">
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-full border border-ink/20 bg-cream px-5 py-3 text-center font-serif text-ink outline-none focus:border-ink"
              />
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-full border border-ink/20 bg-cream px-5 py-3 text-center font-serif text-ink outline-none focus:border-ink"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-ink px-5 py-3 font-serif text-cream transition hover:bg-ink-soft disabled:opacity-60"
              >
                {busy ? "Signing you in…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("code-email");
                }}
                className="font-serif text-sm text-ink-soft underline"
              >
                I&rsquo;d rather use a code
              </button>
              <p className="mt-1 font-serif text-xs text-ink-soft">
                Haven&rsquo;t set a password yet? Sign in with a code first,
                then set one from your account page.
              </p>
            </form>
          </>
        )}

        {notice && (
          <p className="mt-4 font-serif text-sm text-ink-soft">{notice}</p>
        )}
        {error && <p className="mt-4 font-serif text-sm text-red-700">{error}</p>}
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
