"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Inbox as InboxIcon, Loader2, Mail, MailOpen, Reply, Trash2 } from "lucide-react";
import { deleteInbound, markInboundRead, replyToInbound } from "./actions";

export type InboundItem = {
  id: string;
  fromName: string | null;
  fromEmail: string;
  guestName: string | null;
  subject: string;
  body: string;
  receivedAt: string;
  read: boolean;
  repliedAt: string | null;
  attachments: number;
};

function when(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return d.toLocaleString("en-GB", sameDay ? { timeStyle: "short" } : { day: "numeric", month: "short" });
}

// Guests' replies to the wedding's emails. Opening one marks it read.
export function Inbox({ items, address }: { items: InboundItem[]; address: string | null }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="surface mt-6 flex flex-col items-center gap-3 px-6 py-12 text-center">
        <InboxIcon className="h-7 w-7 text-sec" aria-hidden="true" />
        <p className="font-title text-[22px]">No replies yet</p>
        <p className="max-w-md font-reading text-[15px] text-ink-soft">
          {address ? (
            <>
              When guests reply to your emails, or write to <strong className="text-ink">{address}</strong>, their messages
              land here.
            </>
          ) : (
            <>Replies from guests will land here once the wedding&rsquo;s inbox address is switched on.</>
          )}
        </p>
      </div>
    );
  }

  return (
    <ul className="surface mt-6 divide-y divide-ink/10 overflow-hidden p-0">
      {items.map((m) => (
        <InboxRow key={m.id} m={m} open={openId === m.id} onToggle={() => setOpenId(openId === m.id ? null : m.id)} />
      ))}
    </ul>
  );
}

function InboxRow({ m, open, onToggle }: { m: InboundItem; open: boolean; onToggle: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const who = m.guestName ?? m.fromName ?? m.fromEmail;

  function toggle() {
    onToggle();
    if (!open && !m.read) start(async () => {
      await markInboundRead(m.id, true);
      router.refresh();
    });
  }

  function send() {
    setError(null);
    start(async () => {
      const r = await replyToInbound(m.id, draft);
      if (r.error) setError(r.error);
      else {
        setSent(true);
        setReplying(false);
        setDraft("");
        router.refresh();
      }
    });
  }

  return (
    <li className={m.read ? "" : "bg-sec-tint/40"}>
      <button type="button" onClick={toggle} className="flex w-full items-start gap-3 px-5 py-4 text-left" aria-expanded={open}>
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${m.read ? "bg-transparent" : "bg-sec"}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className={`truncate text-[14px] ${m.read ? "font-medium" : "font-semibold"}`}>
              {who}
              {m.guestName == null && <span className="ml-2 text-[12px] font-normal text-ink-soft">not on the guest list</span>}
            </span>
            <span className="shrink-0 text-[12px] text-ink-soft tabular-nums">{when(m.receivedAt)}</span>
          </span>
          <span className="mt-0.5 block truncate text-[13px]">{m.subject || "(no subject)"}</span>
          {!open && <span className="mt-0.5 block truncate font-reading text-[14px] text-ink-soft">{m.body.slice(0, 160)}</span>}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 pl-10">
          <p className="text-[12px] text-ink-soft">
            {m.fromName ? `${m.fromName} · ` : ""}
            {m.fromEmail}
            {m.attachments > 0 && ` · ${m.attachments} attachment${m.attachments === 1 ? "" : "s"} (not shown)`}
          </p>
          <div className="mt-3 whitespace-pre-wrap font-reading text-[15px] leading-relaxed">{m.body || "(empty)"}</div>

          {m.repliedAt && !sent && (
            <p className="mt-3 text-[12px] text-sec">Replied {new Date(m.repliedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
          )}
          {sent && <p className="mt-3 text-[12px] text-sec">Reply sent.</p>}

          {replying ? (
            <div className="mt-4">
              <textarea
                className="field w-full font-reading"
                rows={5}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Reply to ${who}…`}
                autoFocus
              />
              {error && <p className="mt-2 text-[13px] text-alert">{error}</p>}
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={send} disabled={pending || !draft.trim()}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Reply className="h-4 w-4" aria-hidden="true" />}
                  Send reply
                </button>
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => setReplying(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setReplying(true)}>
                <Reply className="h-4 w-4" aria-hidden="true" /> Reply
              </button>
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await markInboundRead(m.id, !m.read);
                    router.refresh();
                  })
                }
              >
                {m.read ? <Mail className="h-4 w-4" aria-hidden="true" /> : <MailOpen className="h-4 w-4" aria-hidden="true" />}
                {m.read ? "Mark unread" : "Mark read"}
              </button>
              <button
                type="button"
                className="btn btn-quiet btn-sm hover:text-alert"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await deleteInbound(m.id);
                    router.refresh();
                  })
                }
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
