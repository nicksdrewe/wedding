"use client";

import { useActionState } from "react";
import { setPassword } from "./actions";

const initialState = { error: null as string | null, success: false };

export function SetPasswordForm() {
  const [state, formAction, pending] = useActionState(setPassword, initialState);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-3">
      <input
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="New password (min. 8 characters)"
        className="rounded-full border border-ink/20 bg-cream px-5 py-3 text-center font-serif text-ink outline-none focus:border-accent"
      />
      <input
        name="confirm"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Confirm password"
        className="rounded-full border border-ink/20 bg-cream px-5 py-3 text-center font-serif text-ink outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-3 font-serif text-cream transition hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Saving…" : "Set password"}
      </button>
      {state.error && (
        <p className="font-serif text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="font-serif text-sm text-ink-soft">
          Done — next time, sign in with your email and this password instead
          of waiting for a code.
        </p>
      )}
    </form>
  );
}
