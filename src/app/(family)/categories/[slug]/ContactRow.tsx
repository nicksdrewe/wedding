"use client";

import { EditableRow } from "@/components/EditableRow";
import { deleteCategoryContact } from "../actions";
import { ContactForm } from "./ContactForm";

type Contact = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
};

// category_contacts: couple manages, family only reads (0001) — the edit
// and delete controls must not render for the family role even though
// they can see this list, so isCouple gates them here, not just styling.
export function ContactRow({
  contact,
  categoryPageId,
  isCouple,
}: {
  contact: Contact;
  categoryPageId: string;
  isCouple: boolean;
}) {
  return (
    <EditableRow
      item={contact}
      isCouple={isCouple}
      onDelete={deleteCategoryContact}
      renderView={(c) => (
        <span className="font-reading text-[13px] text-ink">
          <span className="font-serif font-semibold">{c.name}</span>
          {c.role ? ` — ${c.role}` : ""}
          {c.phone ? ` · ${c.phone}` : ""}
          {c.email ? ` · ${c.email}` : ""}
        </span>
      )}
      renderForm={({ item, onCancel, onSaved }) => (
        <li className="rounded-[8px] border border-ink/8 bg-cream/50 px-3 py-2">
          <ContactForm
            categoryPageId={categoryPageId}
            contact={item}
            onCancel={onCancel}
            onSaved={onSaved}
          />
        </li>
      )}
    />
  );
}
