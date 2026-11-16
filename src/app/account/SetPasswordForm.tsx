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
        className="field text-center w-auto"
      />
      <input
        name="confirm"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Confirm password"
        className="field text-center w-auto"
      />
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary"
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
