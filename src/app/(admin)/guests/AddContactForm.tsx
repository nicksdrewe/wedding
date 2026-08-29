"use client";

import { useRef, useState, useTransition } from "react";
import { addContact } from "./actions";

export function AddContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await addContact(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          formRef.current?.reset();
        })
      }
      className="mt-8 flex flex-wrap items-end gap-3 rounded-2xl border border-ink/10 bg-cream-deep/60 p-5"
    >
      <div className="flex flex-col">
        <label className="text-xs text-ink-soft">Name</label>
        <input
          name="fullName"
          required
          className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-ink-soft">Email</label>
        <input
          name="email"
          type="email"
          className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-ink-soft">Phone</label>
        <input
          name="phone"
          className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-ink-soft">Role</label>
        <select
          name="role"
          defaultValue="guest"
          className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="guest">Guest</option>
          <option value="family">Family</option>
          <option value="wedding_party">Wedding Party</option>
          <option value="couple">Couple</option>
        </select>
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" name="plusOneEligible" />
        Plus-one eligible
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2 text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add guest"}
      </button>
      {error && <p className="pb-2 font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}
