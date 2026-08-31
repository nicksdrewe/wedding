"use client";

import { useState, useTransition } from "react";
import { CornerDownRight, Mail, Phone, UserPlus } from "lucide-react";
import { addChildContact, deleteContact, updateContact } from "./actions";
import { ROLE_BADGE, ROLE_LABEL, RSVP_STYLE } from "./badges";

export type Contact = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  tags: string[] | null;
  plus_one_eligible: boolean;
  rsvp_status: string;
};

const DELETE_WARNING =
  "Delete this guest? Their RSVP, gift claims, and expense-split history will be permanently deleted too. A guest linked as the payer on an expense can't be removed until that expense is reassigned.";

export function EditableGuestRow({
  contact,
  isCouple,
  isChild = false,
  engagementRsvpStatus,
}: {
  contact: Contact;
  isCouple: boolean;
  // True for a contact nested under a parent (e.g. an "other" added via
  // the engagement party's group RSVP) — renders indented directly below
  // the parent's row rather than as its own top-level row. Grouping is
  // done by the caller (guests/page.tsx); this only affects styling.
  isChild?: boolean;
  // Computed by the caller from the shared `rsvps` table (keyed by
  // event_id) rather than read straight off the contact — contact.rsvp_status
  // is a single column that only ever tracks the WEDDING rsvp (see
  // api/rsvp/[token]/route.ts), so it can't also represent this.
  engagementRsvpStatus: "pending" | "attending" | "declined";
}) {
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm(DELETE_WARNING)) return;
    setError(null);
    startDeleteTransition(async () => {
      const result = await deleteContact(contact.id);
      if (result?.error) setError(result.error);
    });
  }

  if (editing) {
    return (
      <td colSpan={8} className="px-5 py-4">
        <GuestEditForm
          contact={contact}
          engagementRsvpStatus={engagementRsvpStatus}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      </td>
    );
  }

  if (addingChild) {
    return (
      <td colSpan={8} className="px-5 py-4">
        <AddChildForm
          parentContactId={contact.id}
          parentName={contact.full_name}
          onCancel={() => setAddingChild(false)}
          onAdded={() => setAddingChild(false)}
        />
      </td>
    );
  }

  const rsvp = RSVP_STYLE[contact.rsvp_status] ?? RSVP_STYLE.pending;
  const RsvpIcon = rsvp.icon;
  const engagementRsvp = RSVP_STYLE[engagementRsvpStatus] ?? RSVP_STYLE.pending;
  const EngagementRsvpIcon = engagementRsvp.icon;

  return (
    <>
      <td className={`px-5 py-3.5 font-medium text-ink ${isChild ? "pl-11 text-ink-soft" : ""}`}>
        {isChild && (
          <CornerDownRight
            className="mr-1.5 inline-block h-3.5 w-3.5 shrink-0 -translate-y-px text-ink-soft/40"
            strokeWidth={2}
            aria-hidden="true"
          />
        )}
        {contact.full_name}
      </td>
      <td className="px-5 py-3.5 text-ink-soft">
        <div className="flex flex-col gap-1">
          {contact.email && (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0 text-ink-soft/60" strokeWidth={2} />
              {contact.email}
            </span>
          )}
          {contact.phone && (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 shrink-0 text-ink-soft/60" strokeWidth={2} />
              {contact.phone}
            </span>
          )}
          {!contact.email && !contact.phone && <span className="text-ink-soft/40">—</span>}
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[0.02em] ${
            ROLE_BADGE[contact.role] ?? ROLE_BADGE.guest
          }`}
        >
          {ROLE_LABEL[contact.role] ?? contact.role}
        </span>
      </td>
      <td className="px-5 py-3.5">
        {contact.tags && contact.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {contact.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink-soft">
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-ink-soft/30">—</span>
        )}
      </td>
      <td className="px-5 py-3.5 text-center">
        {contact.plus_one_eligible ? (
          <UserPlus className="mx-auto h-4 w-4 text-accent" strokeWidth={2} />
        ) : (
          <span className="text-ink-soft/30">—</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[0.02em] ${rsvp.className}`}
        >
          <RsvpIcon className="h-3.5 w-3.5" strokeWidth={2} />
          {rsvp.label}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[0.02em] ${engagementRsvp.className}`}
        >
          <EngagementRsvpIcon className="h-3.5 w-3.5" strokeWidth={2} />
          {engagementRsvp.label}
        </span>
      </td>
      <td className="px-5 py-3.5 text-right">
        {isCouple && (
          // Hover-revealed only on devices that actually have hover — a
          // touch screen has no equivalent of "the cursor happens to be
          // resting over this row", so gating these buttons behind
          // group-hover unconditionally left them permanently invisible
          // on mobile despite the column space being reserved for them.
          <div className="flex shrink-0 justify-end gap-3 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
            {/* Only on top-level rows — a plus-one's plus-one isn't a
                shape the engagement RSVP form itself ever produces, and
                the DB has no need to support arbitrarily deep nesting. */}
            {!isChild && (
              <button
                type="button"
                onClick={() => setAddingChild(true)}
                className="font-serif text-[11px] tracking-[0.06em] text-ink-soft uppercase hover:text-accent"
              >
                + Plus one
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-serif text-[11px] tracking-[0.06em] text-ink-soft uppercase hover:text-accent"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deletePending}
              className="font-serif text-[11px] tracking-[0.06em] text-alert/80 uppercase hover:text-alert disabled:opacity-60"
            >
              {deletePending ? "Deleting…" : "Delete"}
            </button>
          </div>
        )}
        {error && <p className="mt-1 font-reading text-[11px] whitespace-normal text-alert">{error}</p>}
      </td>
    </>
  );
}

function GuestEditForm({
  contact,
  engagementRsvpStatus,
  onCancel,
  onSaved,
}: {
  contact: Contact;
  engagementRsvpStatus: "pending" | "attending" | "declined";
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateContact(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <form action={handleSubmit} className="rounded-[10px] border border-ink/10 bg-white/50 p-4">
      <input type="hidden" name="id" value={contact.id} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="font-serif text-[11px] font-medium tracking-[0.04em] text-ink-soft uppercase">
            Name
          </label>
          <input
            name="fullName"
            required
            defaultValue={contact.full_name}
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
            defaultValue={contact.email ?? ""}
            className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors duration-150 focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-serif text-[11px] font-medium tracking-[0.04em] text-ink-soft uppercase">
            Phone
          </label>
          <input
            name="phone"
            defaultValue={contact.phone ?? ""}
            className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors duration-150 focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-serif text-[11px] font-medium tracking-[0.04em] text-ink-soft uppercase">
            Role
          </label>
          <select
            name="role"
            defaultValue={contact.role}
            className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors duration-150 focus:border-accent"
          >
            <option value="guest">Guest</option>
            <option value="family">Family</option>
            <option value="wedding_party">Wedding Party</option>
            <option value="couple">Couple</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-serif text-[11px] font-medium tracking-[0.04em] text-ink-soft uppercase">
            Tags
          </label>
          <input
            name="tags"
            defaultValue={(contact.tags ?? []).join(", ")}
            placeholder="comma, separated"
            className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors duration-150 focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-serif text-[11px] font-medium tracking-[0.04em] text-ink-soft uppercase">
            Wedding RSVP
          </label>
          <select
            name="rsvpStatus"
            defaultValue={contact.rsvp_status}
            className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors duration-150 focus:border-accent"
          >
            <option value="pending">Pending</option>
            <option value="attending">Attending</option>
            <option value="declined">Declined</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-serif text-[11px] font-medium tracking-[0.04em] text-ink-soft uppercase">
            Engagement RSVP
          </label>
          <select
            name="engagementRsvpStatus"
            defaultValue={engagementRsvpStatus}
            className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors duration-150 focus:border-accent"
          >
            <option value="pending">Pending</option>
            <option value="attending">Attending</option>
            <option value="declined">Declined</option>
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="plusOneEligible"
            defaultChecked={contact.plus_one_eligible}
            className="accent-accent"
          />
          Plus-one eligible
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-ink px-5 py-2 text-sm text-cream transition-colors duration-150 hover:bg-ink-soft disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-ink/20 px-5 py-2 text-sm text-ink-soft transition-colors duration-150 hover:border-ink/40"
          >
            Cancel
          </button>
        </div>
      </div>
      {error && <p className="mt-3 font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}

// For a guest who didn't use the engagement RSVP form's own "bringing
// others" field the first time round — this creates the same shape that
// field does (a child contact under this one, see 0011_contact_hierarchy.sql)
// so it appears indented under the parent exactly like a self-service
// addition would, rather than as its own unrelated top-level row.
function AddChildForm({
  parentContactId,
  parentName,
  onCancel,
  onAdded,
}: {
  parentContactId: string;
  parentName: string;
  onCancel: () => void;
  onAdded: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addChildContact(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onAdded();
    });
  }

  return (
    <form action={handleSubmit} className="rounded-[10px] border border-ink/10 bg-white/50 p-4">
      <input type="hidden" name="parentContactId" value={parentContactId} />
      <p className="mb-3 font-serif text-[11px] font-medium tracking-[0.04em] text-ink-soft uppercase">
        Add a plus one under {parentName}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="font-serif text-[11px] font-medium tracking-[0.04em] text-ink-soft uppercase">
            Name
          </label>
          <input
            name="fullName"
            required
            autoFocus
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
        <label className="flex items-center gap-2 pb-2 text-sm text-ink-soft">
          <input type="checkbox" name="attendingEngagement" defaultChecked className="accent-accent" />
          Attending engagement party
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-ink px-5 py-2 text-sm text-cream transition-colors duration-150 hover:bg-ink-soft disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-ink/20 px-5 py-2 text-sm text-ink-soft transition-colors duration-150 hover:border-ink/40"
          >
            Cancel
          </button>
        </div>
      </div>
      {error && <p className="mt-3 font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}
