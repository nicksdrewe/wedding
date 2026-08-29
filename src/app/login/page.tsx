"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Two-step code entry rather than a clickable magic link: email security
// scanners (Gmail's especially) fetch links in messages before the recipient
// clicks, and a magic-link token is single-use — so the scanner consumes the
// sign-in and the real click always lands on an expired token. A typed code
// has no URL to prefetch.
export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
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
    setStep("code");
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
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-script text-4xl">Sign in</h1>

        {step === "email" ? (
          <>
            <p className="mt-2 font-serif text-ink-soft">
              Pop in your email and we&rsquo;ll send you a six-digit code.
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
            </form>
          </>
        ) : (
          <>
            <p className="mt-2 font-serif text-ink-soft">
              We&rsquo;ve sent a six-digit code to{" "}
              <span className="text-ink">{email}</span>. Enter it below.
            </p>
            <form onSubmit={verifyCode} className="mt-8 flex flex-col gap-3">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="rounded-full border border-ink/20 bg-cream px-5 py-3 text-center font-serif text-2xl tracking-[0.5em] text-ink outline-none focus:border-ink"
              />
              <button
                type="submit"
                disabled={busy || code.length < 6}
                className="rounded-full bg-ink px-5 py-3 font-serif text-cream transition hover:bg-ink-soft disabled:opacity-60"
              >
                {busy ? "Checking…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
                className="font-serif text-sm text-ink-soft underline"
              >
                Use a different email
              </button>
            </form>
          </>
        )}

        {error && <p className="mt-4 font-serif text-sm text-red-700">{error}</p>}
      </div>
    </main>
  );
}
