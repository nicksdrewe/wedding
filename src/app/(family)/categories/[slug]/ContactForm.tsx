"use client";

import { useRef, useState, useTransition } from "react";
import { addCategoryContact } from "../actions";

export function ContactForm({ categoryPageId }: { categoryPageId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await addCategoryContact(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          formRef.current?.reset();
        })
      }
      className="mt-3 flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="categoryPageId" value={categoryPageId} />
      <input
        name="name"
        required
        placeholder="Name"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <input
        name="role"
        placeholder="Role"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <input
        name="phone"
        placeholder="Phone"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2 text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add contact"}
      </button>
      {error && <p className="w-full font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}
