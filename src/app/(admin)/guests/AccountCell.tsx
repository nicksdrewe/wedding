"use client";

import { useRef, useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import useClickOutside from "@/hooks/useClickOutside";
import {
  createAccount,
  resetAccount,
  sendAccountInvite,
  setAccountDisabled,
  signOutEverywhere,
} from "@/lib/accounts/actions";
import { timeAgo, type AccountStatus } from "@/lib/accounts/types";

const PILL: Record<AccountStatus["state"], { label: string; className: string }> = {
  none: { label: "No account", className: "bg-cream-deep text-ink-soft" },
  invited: { label: "Not signed in yet", className: "bg-accent/10 text-accent" },
  active: { label: "Active", className: "bg-accent/15 text-accent" },
  disabled: { label: "Switched off", className: "bg-alert/12 text-alert" },
  "no-email": { label: "Needs an email", className: "bg-ink/5 text-ink-soft/70" },
  duplicate: { label: "Duplicate email", className: "bg-alert/10 text-alert" },
};

type Action = { label: string; run: () => Promise<{ error: string | null; notice?: string }>; confirm?: string; danger?: boolean };

// One guest's account: a status pill plus a small menu of what the couple
// can do next. Every button maps to a server action that re-checks that the
// caller is Nick or Ellie — this component only decides what's worth offering.
export function AccountCell({ contactId, status }: { contactId: string; status: AccountStatus }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const pill = PILL[status.state];

  const actions: Action[] =
    status.state === "none"
      ? [
          { label: "Create account & send invite", run: () => createAccount(contactId, true) },
          { label: "Create account only", run: () => createAccount(contactId, false) },
        ]
      : status.state === "invited" || status.state === "active"
        ? [
            { label: "Send invite email", run: () => sendAccountInvite(contactId) },
            {
              label: "Reset password",
              run: () => resetAccount(contactId),
              confirm:
                "Reset their password? Any password stops working, they're signed out of every device, and they're emailed how to sign back in with a code.",
            },
            {
              label: "Sign out everywhere",
              run: () => signOutEverywhere(contactId),
              confirm: "Sign them out of every device? They'll need to sign in again.",
            },
            {
              label: "Switch account off",
              run: () => setAccountDisabled(contactId, true),
              confirm: "Switch this account off? They're signed out and can't sign in until you switch it back on.",
              danger: true,
            },
          ]
        : status.state === "disabled"
          ? [{ label: "Switch account back on", run: () => setAccountDisabled(contactId, false) }]
          : [];

  function perform(action: Action) {
    if (action.confirm && !window.confirm(action.confirm)) return;
    setOpen(false);
    setMessage(null);
    startTransition(async () => {
      const result = await action.run();
      if (result.error) setMessage({ text: result.error, isError: true });
      else if (result.notice) setMessage({ text: result.notice, isError: false });
    });
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[0.02em] ${pill.className}`}>
          {pending ? "Working…" : pill.label}
        </span>
        {actions.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Account actions"
            aria-expanded={open}
            disabled={pending}
            className="rounded-full p-1 text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-50"
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
      </div>
      {status.state === "active" && (
        <p className="mt-0.5 font-reading text-[11px] text-ink-soft/70">Last in {timeAgo(status.lastSignInAt)}</p>
      )}
      {status.state === "duplicate" && (
        <p className="mt-0.5 max-w-[11rem] font-reading text-[11px] whitespace-normal text-ink-soft/70">
          Another entry shares this email. Fix one so the account goes to the right person.
        </p>
      )}
      {message && (
        <p
          className={`mt-1 max-w-[14rem] font-reading text-[11px] whitespace-normal ${message.isError ? "text-alert" : "text-accent"}`}
        >
          {message.text}
        </p>
      )}
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-60 overflow-hidden rounded-[10px] border border-ink/10 bg-white py-1 shadow-[0_10px_30px_rgba(35,37,32,0.14)]">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => perform(a)}
              className={`block w-full px-4 py-2 text-left font-serif text-xs transition-colors hover:bg-cream-deep/60 ${
                a.danger ? "text-alert" : "text-ink"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
