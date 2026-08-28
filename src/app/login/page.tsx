"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-script text-4xl">Sign in</h1>
        <p className="mt-2 font-serif text-ink-soft">
          We&rsquo;ll email you a link — no password needed.
        </p>

        {status === "sent" ? (
          <p className="mt-8 font-serif">
            Check your inbox for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-full border border-ink/20 bg-cream px-5 py-3 font-serif text-ink outline-none focus:border-ink"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-full bg-ink px-5 py-3 font-serif text-cream transition hover:bg-ink-soft disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Send sign-in link"}
            </button>
            {status === "error" && (
              <p className="text-sm text-red-700">
                Something went wrong — try again.
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
