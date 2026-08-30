"use client";

import { useRef, useState, useTransition } from "react";
import { addCategoryContact, updateCategoryContact } from "../actions";

type Contact = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
};

export function ContactForm({
  categoryPageId,
  contact,
  onCancel,
  onSaved,
}: {
  categoryPageId: string;
  contact?: Contact;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!contact;

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = isEditing
            ? await updateCategoryContact(formData)
            : await addCategoryContact(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          if (isEditing) {
            onSaved?.();
          } else {
            formRef.current?.reset();
          }
        })
      }
      className="mt-4 flex flex-wrap items-end gap-3"
    >
      {isEditing ? (
        <input type="hidden" name="id" value={contact.id} />
      ) : (
        <input type="hidden" name="categoryPageId" value={categoryPageId} />
      )}
      <input
        name="name"
        required
        defaultValue={contact?.name}
        placeholder="Name"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors focus:border-accent"
      />
      <input
        name="role"
        defaultValue={contact?.role ?? ""}
        placeholder="Role"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors focus:border-accent"
      />
      <input
        name="phone"
        defaultValue={contact?.phone ?? ""}
        placeholder="Phone"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors focus:border-accent"
      />
      <input
        name="email"
        type="email"
        defaultValue={contact?.email ?? ""}
        placeholder="Email"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2 text-sm text-cream transition-colors hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Saving…" : isEditing ? "Save" : "Add contact"}
      </button>
      {isEditing && (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-ink/20 px-5 py-2 text-sm text-ink-soft transition-colors hover:border-ink/40"
        >
          Cancel
        </button>
      )}
      {error && <p className="w-full font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}
