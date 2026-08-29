"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Typed code rather than a clickable magic link: email security scanners
// (Gmail's especially) fetch links in a message before the recipient clicks,
// and the token is single-use — so the scanner consumed the sign-in and the
// real click always arrived with a spent token. A code has no URL to prefetch.
//
// Supabase's OTP length is configurable and currently returns 8 digits, so
// accept a range rather than pinning to one length — a hard maxLength of 6
// silently truncates a valid code and makes sign-in impossible.
const CODE_MIN = 6;
const CODE_MAX = 10;
const PENDING_EMAIL_KEY = "pending-signin-email";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Survive a reload, or reading the email on another device and coming back.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PENDING_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setStep("code");
      }
    } catch {
      // storage unavailable (private mode, blocked cookies) — start at step 1
    }
  }, []);

  function rememberEmail(value: string | null) {
    try {
      if (value) window.localStorage.setItem(PENDING_EMAIL_KEY, value);
      else window.localStorage.removeItem(PENDING_EMAIL_KEY);
    } catch {
      // non-fatal; the in-memory state still carries the flow
    }
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error) {
      setError(
        error.message.toLowerCase().includes("signups not allowed")
          ? "We don't have that email on our guest list. Double-check it, or ask Nick or Ellie to add you."
          : error.message
      );
      return;
    }
    rememberEmail(email);
    setStep("code");
    setNotice(`Code sent to ${email}.`);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      setError("That code wasn't right, or it's expired. Try again.");
      return;
    }
    rememberEmail(null);
    router.push("/");
    router.refresh();
  }

  function startOver() {
    rememberEmail(null);
    setStep("email");
    setCode("");
    setError(null);
    setNotice(null);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-script text-4xl">Sign in</h1>

        {step === "email" ? (
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
              <button
                type="button"
                onClick={() => {
                  setStep("code");
                  setNotice(null);
                }}
                className="font-serif text-sm text-ink-soft underline"
              >
                I already have a code
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-2 font-serif text-ink-soft">
              Enter the code from your email
              {email ? (
                <>
                  {" "}
                  (sent to <span className="text-ink">{email}</span>)
                </>
              ) : null}
              .
            </p>
            <form onSubmit={verifyCode} className="mt-8 flex flex-col gap-3">
              {!email && (
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-full border border-ink/20 bg-cream px-5 py-3 text-center font-serif text-ink outline-none focus:border-ink"
                />
              )}
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
                {busy ? "Checking…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={startOver}
                className="font-serif text-sm text-ink-soft underline"
              >
                Send a new code
              </button>
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
