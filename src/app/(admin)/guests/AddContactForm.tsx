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
      className="surface surface-sunken mt-8 p-5"
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
            className="field w-auto"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-serif text-[11px] font-medium tracking-[0.04em] text-ink-soft uppercase">
            Email
          </label>
          <input
            name="email"
            type="email"
            className="field w-auto"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-serif text-[11px] font-medium tracking-[0.04em] text-ink-soft uppercase">
            Phone
          </label>
          <input
            name="phone"
            className="field w-auto"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-serif text-[11px] font-medium tracking-[0.04em] text-ink-soft uppercase">
            Role
          </label>
          <select
            name="role"
            defaultValue="guest"
            className="field w-auto"
          >
            <option value="guest">Guest</option>
            <option value="family">Family</option>
            <option value="wedding_party">Wedding Party</option>
            <option value="couple">Couple</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-serif text-[11px] font-medium tracking-[0.04em] text-ink-soft uppercase">
            Plus-ones
          </label>
          <input
            type="number"
            name="plusOneLimit"
            min={0}
            defaultValue={0}
            className="field w-20"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Adding…" : "Add guest"}
        </button>
      </div>
      {error && <p className="mt-3 font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}
