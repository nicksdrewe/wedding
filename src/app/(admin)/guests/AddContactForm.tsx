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
      className="mt-8 rounded-[10px] border border-ink/10 bg-white/50 p-5"
    >
      <p className="mb-4 font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
        Add a guest
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="font-serif text-[11px] font-medium tracking-[0.04em] text-ink-soft uppercase">
            Name
          </label>
          <input
            name="fullName"
            required
            className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors duration-150 focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-serif text-[11px] font-medium tracking-[0.04em] text-ink-soft uppercase">
            Email
          </label>
          <input
            name="email"
            type="email"
            className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors duration-150 focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-serif text-[11px] font-medium tracking-[0.04em] text-ink-soft uppercase">
            Phone
          </label>
          <input
            name="phone"
            className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors duration-150 focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-serif text-[11px] font-medium tracking-[0.04em] text-ink-soft uppercase">
            Role
          </label>
          <select
            name="role"
            defaultValue="guest"
            className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors duration-150 focus:border-accent"
          >
            <option value="guest">Guest</option>
            <option value="family">Family</option>
            <option value="wedding_party">Wedding Party</option>
            <option value="couple">Couple</option>
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-ink-soft">
          <input type="checkbox" name="plusOneEligible" className="accent-accent" />
          Plus-one eligible
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-5 py-2 text-sm text-cream transition-colors duration-150 hover:bg-ink-soft disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add guest"}
        </button>
      </div>
      {error && <p className="mt-3 font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}
