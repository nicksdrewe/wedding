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

// category_contacts (0033_party_planner_access.sql): anyone with "Can edit"
// on the category may add and edit contacts; removing one is couple-only.
// isCouple here means "may edit"; canDelete is the stricter right. The
// controls must not render for someone RLS would refuse.
export function ContactRow({
  contact,
  categoryPageId,
  isCouple,
  canDelete = isCouple,
}: {
  contact: Contact;
  categoryPageId: string;
  isCouple: boolean;
  canDelete?: boolean;
}) {
  return (
    <EditableRow
      item={contact}
      isCouple={isCouple}
      onDelete={canDelete ? deleteCategoryContact : undefined}
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
