"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthScene } from "./AuthScene";
import { SplitWord } from "./SplitWord";
import { GalaxyButton } from "./GalaxyButton";
import { Whoosh } from "./Whoosh";

// Sign-in as an experience. The first time: email, the code from the email,
// then straight on to choosing a password (twice), so every later visit is
// just email and password. First time in gets the full sweep; returning
// sign-ins get the same look with a quick fade, so it never takes long.
//
// The code is typed rather than a clickable link because email security
// scanners open links before you do and use up single-use tokens.

const CODE_MIN = 6;
const CODE_MAX = 10;
const PENDING_EMAIL_KEY = "pending-signin-email";
const HAS_PASSWORD_KEY = "has-password";

type Step = "email" | "code" | "set" | "login";

const INPUT =
  "w-full rounded-2xl border border-ink/15 bg-white px-4 py-3.5 font-reading text-[15px] text-ink shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
const PLAIN_BUTTON =
  "w-full rounded-full bg-ink px-5 py-3.5 font-serif text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60";
const LINK = "font-serif text-xs text-ink-soft underline decoration-ink/30 underline-offset-2 hover:text-sec";

function remember(key: string, value: string | null) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // storage unavailable: carry on without it
  }
}
function recall(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function LoginExperience({ next = "/hub", startAt }: { next?: string; startAt?: string | null }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<"cinematic" | "quick" | null>(null);

  // Where to begin: choosing a password (just signed in with a code elsewhere),
  // password sign-in (been here before), the code step (a code is on its way),
  // or the start.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (startAt === "password") {
        const { data } = await createClient().auth.getUser();
        if (!cancelled && data.user) {
          setEmail(data.user.email ?? "");
          setStep("set");
          return;
        }
      }
      if (cancelled) return;
      const saved = recall(PENDING_EMAIL_KEY);
      if (recall(HAS_PASSWORD_KEY)) {
        setStep("login");
      } else if (saved) {
        setEmail(saved);
        setStep("code");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startAt]);

  function go(mode: "cinematic" | "quick") {
    setLeaving(mode);
    // A hard navigation rather than the client router, so the server renders
    // the destination with the new session.
    window.setTimeout(() => window.location.assign(next), mode === "cinematic" ? 1650 : 380);
  }

  function to(s: Step) {
    setStep(s);
    setError(null);
    setNotice(null);
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Only emails already on the guest list may ask for a code (checked on the
    // server, which the browser cannot read the list from).
    const eligibility = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!eligibility.ok) {
      setBusy(false);
      const body = await eligibility.json().catch(() => null);
      setError(body?.error ?? "We don't have that email on our guest list. Check with Nick or Ellie.");
      return;
    }
    // Sign-in never creates an account: those are made by the couple.
    const { error } = await createClient().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    remember(PENDING_EMAIL_KEY, email);
    setStep("code");
    setNotice(`Code sent to ${email}. It can take a minute to arrive.`);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
    if (error) {
      setBusy(false);
      setError("That code wasn't right, or it has expired. Try again.");
      return;
    }
    remember(PENDING_EMAIL_KEY, null);
    const { data } = await supabase.auth.getUser();
    setBusy(false);
    if (data.user?.user_metadata?.password_set) {
      remember(HAS_PASSWORD_KEY, "1");
      go("quick");
    } else {
      to("set");
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Make it at least 8 characters.");
    if (password !== confirm) return setError("Those two don't match.");
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password, data: { password_set: true } });
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    remember(HAS_PASSWORD_KEY, "1");
    go("cinematic");
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      setError("That email and password don't match.");
      return;
    }
    remember(HAS_PASSWORD_KEY, "1");
    go("quick");
  }

  const word = step === "login" ? "Login" : step === "set" ? "Almost" : "Welcome";

  return (
    <>
      <AuthScene>
        <div className="w-full max-w-[380px]">
          <SplitWord key={`${word}-${step}`} word={word} />

          {step === "email" && (
            <form onSubmit={sendCode} className="mt-8 flex flex-col gap-3">
              <p className="font-reading text-[15px] text-ink-soft">Pop in your email and we&rsquo;ll send you a code.</p>
              <input type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
              <button type="submit" disabled={busy} className={PLAIN_BUTTON}>
                {busy ? "Sending…" : "Send my code"}
              </button>
              <div className="flex justify-between pt-1">
                <button type="button" onClick={() => to("code")} className={LINK}>
                  I already have a code
                </button>
                <button type="button" onClick={() => to("login")} className={LINK}>
                  I have a password
                </button>
              </div>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={verifyCode} className="mt-8 flex flex-col gap-3">
              <p className="font-reading text-[15px] text-ink-soft">Enter the code from your email.</p>
              <input type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={CODE_MAX}
                placeholder="Your code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className={`${INPUT} text-center font-serif text-2xl tracking-[0.3em]`}
                autoFocus
              />
              <button type="submit" disabled={busy || code.length < CODE_MIN || !email} className={PLAIN_BUTTON}>
                {busy ? "Checking…" : "Verify"}
              </button>
              <button
                type="button"
                onClick={() => {
                  remember(PENDING_EMAIL_KEY, null);
                  setCode("");
                  to("email");
                }}
                className={`${LINK} self-start pt-1`}
              >
                Send a new code
              </button>
            </form>
          )}

          {step === "set" && (
            <form onSubmit={savePassword} className="mt-8 flex flex-col gap-3">
              <p className="font-reading text-[15px] text-ink-soft">
                Choose a password, so next time you can sign straight in with your email and this.
              </p>
              <input type="password" required minLength={8} autoComplete="new-password" placeholder="Choose a password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} autoFocus />
              <input type="password" required minLength={8} autoComplete="new-password" placeholder="Type it again" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={INPUT} />
              <div className="pt-1">
                <GalaxyButton disabled={busy}>{busy ? "One moment…" : "Let’s go"}</GalaxyButton>
              </div>
              <button type="button" onClick={() => go("quick")} className={`${LINK} self-start pt-1`}>
                Skip for now
              </button>
            </form>
          )}

          {step === "login" && (
            <form onSubmit={signInWithPassword} className="mt-8 flex flex-col gap-3">
              <input type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
              <input type="password" required autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
              <div className="pt-1">
                <GalaxyButton disabled={busy}>{busy ? "Signing you in…" : "Login"}</GalaxyButton>
              </div>
              <button type="button" onClick={() => to("email")} className={`${LINK} self-start pt-1`}>
                First time, or forgotten your password? Get a code
              </button>
            </form>
          )}

          {notice && <p className="mt-5 font-reading text-sm text-ink-soft">{notice}</p>}
          {error && <p className="mt-5 font-reading text-sm text-alert">{error}</p>}
        </div>
      </AuthScene>
      {leaving && <Whoosh mode={leaving} />}
    </>
  );
}
