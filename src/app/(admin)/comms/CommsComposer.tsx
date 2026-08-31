"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, Mail, Send, Users } from "lucide-react";
import { createMessage, sendToRecipient } from "./actions";

export type CommsContact = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  tags: string[];
  engagementStatus: "pending" | "attending" | "declined";
  weddingStatus: "pending" | "attending" | "declined";
};

export type MessageHistoryItem = {
  id: string;
  subject: string;
  createdAt: string;
  total: number;
  sent: number;
  failed: number;
};

const SELECT_CLASS =
  "rounded-full border border-ink/20 bg-cream px-3.5 py-1.5 text-xs text-ink-soft outline-none transition-colors duration-150 focus:border-accent focus:text-ink";

// Between each individual send — Resend's free tier caps at roughly 2
// requests/second; comfortably under that without needing a real queue,
// and each recipient is its own request from the client rather than one
// server action looping the whole audience (see lib/email/resend.ts for
// why: bulk-in-one-request risks the serverless function's own time
// limit on a large guest list).
const SEND_SPACING_MS = 450;

type SendState =
  | { phase: "idle" }
  | { phase: "sending"; done: number; total: number; failed: number }
  | { phase: "done"; sent: number; failed: number; failedNames: string[] };

export function CommsComposer({
  contacts,
  history,
}: {
  contacts: CommsContact[];
  history: MessageHistoryItem[];
}) {
  const [role, setRole] = useState("");
  const [tag, setTag] = useState("");
  const [engagementStatus, setEngagementStatus] = useState("");
  const [weddingStatus, setWeddingStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  // "text": what you type is escaped and paragraph-wrapped server-side
  // (see actions.ts's toHtml). "html": the body is sent through exactly
  // as pasted — for code exported from an external email builder (Stripo
  // and similar), which already carries its own layout/markup that
  // escaping would both break and render as literal visible tags.
  const [bodyMode, setBodyMode] = useState<"text" | "html">("text");
  const [sendState, setSendState] = useState<SendState>({ phase: "idle" });
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of contacts) c.tags.forEach((t) => set.add(t));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (role && c.role !== role) return false;
      if (tag && !c.tags.includes(tag)) return false;
      if (engagementStatus && c.engagementStatus !== engagementStatus) return false;
      if (weddingStatus && c.weddingStatus !== weddingStatus) return false;
      if (q && !c.full_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [contacts, role, tag, engagementStatus, weddingStatus, search]);

  const filteredIds = useMemo(() => filtered.map((c) => c.id), [filtered]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredIds.forEach((id) => next.delete(id));
      } else {
        filteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  const canSend =
    sendState.phase !== "sending" && subject.trim().length > 0 && body.trim().length > 0 && selected.size > 0;

  async function handleSend() {
    if (!canSend) return;
    const recipientIds = [...selected];
    const { messageId, error: createError } = await createMessage(subject.trim(), body, bodyMode);
    if (createError || !messageId) {
      setSendState({ phase: "done", sent: 0, failed: recipientIds.length, failedNames: ["Couldn't create the message — try again."] });
      return;
    }

    setSendState({ phase: "sending", done: 0, total: recipientIds.length, failed: 0 });

    let sentCount = 0;
    let failedCount = 0;
    const failedNames: string[] = [];
    const byId = new Map(contacts.map((c) => [c.id, c]));

    for (let i = 0; i < recipientIds.length; i++) {
      const contactId = recipientIds[i];
      const { error } = await sendToRecipient(messageId, contactId);
      if (error) {
        failedCount++;
        failedNames.push(byId.get(contactId)?.full_name ?? contactId);
      } else {
        sentCount++;
      }
      setSendState({ phase: "sending", done: i + 1, total: recipientIds.length, failed: failedCount });
      if (i < recipientIds.length - 1) {
        await new Promise((r) => setTimeout(r, SEND_SPACING_MS));
      }
    }

    setSendState({ phase: "done", sent: sentCount, failed: failedCount, failedNames });
    setSelected(new Set());
    setSubject("");
    setBody("");
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_1fr]">
      <div>
        {/* Audience */}
        <div className="rounded-[10px] border border-ink/10 bg-white/60 p-5">
          <p className="flex items-center gap-1.5 font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
            <Users className="h-3.5 w-3.5" strokeWidth={2} />
            Audience — {selected.size} selected
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-full border border-ink/20 bg-cream px-3.5 py-1.5 text-xs text-ink outline-none placeholder:text-ink-soft/50 focus:border-accent"
            />
            <select value={role} onChange={(e) => setRole(e.target.value)} className={SELECT_CLASS}>
              <option value="">All roles</option>
              <option value="guest">Guest</option>
              <option value="family">Family</option>
              <option value="wedding_party">Wedding Party</option>
              <option value="couple">Couple</option>
            </select>
            {allTags.length > 0 && (
              <select value={tag} onChange={(e) => setTag(e.target.value)} className={SELECT_CLASS}>
                <option value="">All tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
            <select
              value={engagementStatus}
              onChange={(e) => setEngagementStatus(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Engagement RSVP: any</option>
              <option value="attending">Attending</option>
              <option value="declined">Declined</option>
              <option value="pending">Pending</option>
            </select>
            <select value={weddingStatus} onChange={(e) => setWeddingStatus(e.target.value)} className={SELECT_CLASS}>
              <option value="">Wedding RSVP: any</option>
              <option value="attending">Attending</option>
              <option value="declined">Declined</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="mt-4 flex items-center justify-between border-b border-ink/10 pb-2">
            <button
              type="button"
              onClick={toggleAllFiltered}
              className="font-serif text-[11px] tracking-[0.06em] text-accent uppercase hover:underline"
            >
              {allFilteredSelected ? "Deselect all shown" : `Select all ${filtered.length} shown`}
            </button>
            <span className="font-reading text-xs text-ink-soft/60">
              {filtered.length} of {contacts.length}
            </span>
          </div>

          <div className="mt-2 max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-6 text-center font-reading text-sm text-ink-soft italic">No guests match these filters.</p>
            ) : (
              filtered.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-3 rounded-[8px] px-2 py-2 transition-colors duration-150 hover:bg-cream-deep/50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleOne(c.id)}
                    className="accent-accent"
                  />
                  <span className="min-w-0 flex-1 truncate font-serif text-sm text-ink">{c.full_name}</span>
                  <span className="shrink-0 truncate font-reading text-xs text-ink-soft/60">{c.email}</span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Compose */}
        <div className="mt-6 rounded-[10px] border border-ink/10 bg-white/60 p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
              <Mail className="h-3.5 w-3.5" strokeWidth={2} />
              Message
            </p>
            <div className="flex gap-0.5 rounded-full bg-cream-deep p-1">
              <button
                type="button"
                onClick={() => setBodyMode("text")}
                className={`rounded-full px-3 py-1 font-serif text-[11px] tracking-wide transition ${
                  bodyMode === "text" ? "bg-ink text-cream" : "text-ink-soft"
                }`}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setBodyMode("html")}
                className={`rounded-full px-3 py-1 font-serif text-[11px] tracking-wide transition ${
                  bodyMode === "html" ? "bg-ink text-cream" : "text-ink-soft"
                }`}
              >
                Paste HTML
              </button>
            </div>
          </div>

          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            className="mt-3 w-full rounded-full border border-ink/20 bg-cream px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-soft/50 focus:border-accent"
          />

          {bodyMode === "text" ? (
            <textarea
              placeholder={"Write your message…\n\nUse {{name}} anywhere you want it replaced with each guest's first name."}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={20000}
              rows={10}
              className="mt-3 w-full rounded-[10px] border border-ink/20 bg-cream px-4 py-3 font-reading text-sm text-ink outline-none placeholder:text-ink-soft/50 focus:border-accent"
            />
          ) : (
            <>
              <p className="mt-3 font-reading text-xs text-ink-soft/70 italic">
                Paste the HTML code exported from your email builder (e.g. Stripo) below — it&rsquo;s sent exactly
                as pasted, no escaping. {"{{name}}"} still works anywhere inside it.
              </p>
              <textarea
                placeholder="<html>…paste your exported email code here…</html>"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={20000}
                rows={8}
                spellCheck={false}
                className="mt-2 w-full rounded-[10px] border border-ink/20 bg-cream px-4 py-3 font-mono text-xs text-ink outline-none placeholder:text-ink-soft/50 focus:border-accent"
              />
              {body.trim() && (
                <div className="mt-3">
                  <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                    Preview
                  </p>
                  {/* Sandboxed with every permission withheld — this only
                      needs to render the couple's own pasted markup for a
                      visual check, never execute scripts or reach outside
                      itself. */}
                  <iframe
                    title="Email preview"
                    srcDoc={body}
                    sandbox=""
                    className="mt-2 h-72 w-full rounded-[10px] border border-ink/20 bg-white"
                  />
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-serif text-sm text-cream transition-colors duration-150 hover:bg-ink-soft disabled:opacity-50"
          >
            {sendState.phase === "sending" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                Sending {sendState.done} of {sendState.total}…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" strokeWidth={2} />
                Send to {selected.size} {selected.size === 1 ? "guest" : "guests"}
              </>
            )}
          </button>

          {sendState.phase === "done" && (
            <div className="mt-3 rounded-[8px] bg-cream-deep/60 px-4 py-3">
              <p className="flex items-center gap-1.5 font-reading text-sm text-ink">
                <Check className="h-4 w-4 text-accent" strokeWidth={2.5} />
                Sent to {sendState.sent} {sendState.sent === 1 ? "guest" : "guests"}
                {sendState.failed > 0 && `, ${sendState.failed} failed`}.
              </p>
              {sendState.failed > 0 && (
                <p className="mt-1 font-reading text-xs text-alert">
                  Couldn&rsquo;t reach: {sendState.failedNames.join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="rounded-[10px] border border-ink/10 bg-white/60 p-5">
        <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Sent before</p>
        {history.length === 0 ? (
          <p className="mt-4 font-reading text-sm text-ink-soft italic">Nothing sent yet.</p>
        ) : (
          <div className="mt-3 divide-y divide-ink/8">
            {history.map((m) => {
              const open = historyOpenId === m.id;
              return (
                <div key={m.id} className="py-3">
                  <button
                    type="button"
                    onClick={() => setHistoryOpenId(open ? null : m.id)}
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-serif text-sm text-ink">{m.subject}</p>
                      <p className="mt-0.5 font-reading text-xs text-ink-soft/70">
                        {new Date(m.createdAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        · {m.sent} sent{m.failed > 0 ? `, ${m.failed} failed` : ""} of {m.total}
                      </p>
                    </div>
                    {open ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-ink-soft/50" strokeWidth={2} />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-ink-soft/50" strokeWidth={2} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
