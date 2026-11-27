"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteCampaign, draftFromNumbers, saveCampaign, sendCampaign, sendTest } from "@/lib/platform/actions";

export function Composer({ draft, audience }: { draft: { id: string; subject: string; body: string } | null; audience: number }) {
  const router = useRouter();
  const [id, setId] = useState(draft?.id);
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<void>) => start(async () => {
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  });

  const save = async () => {
    const r = await saveCampaign({ id, subject, body });
    if (!r.ok) throw new Error(r.error);
    setId(r.id);
    return r.id!;
  };

  return (
    <div className="pc-stack">
      <label className="pc-field">
        Subject
        <input className="pc-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's new this month" />
      </label>
      <label className="pc-field">
        Newsletter
        <textarea className="pc-textarea" style={{ minHeight: 280 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hello from Weddings Weddings…" />
      </label>
      {msg && <p className={`pc-note ${msg.ok ? "" : "bad"}`}>{msg.text}</p>}
      {confirming ? (
        <div className="pc-note warn pc-stack" style={{ gap: 10 }}>
          <span>
            Send &ldquo;{subject}&rdquo; to {audience} couple{audience === 1 ? "" : "s"} now? It can&rsquo;t be unsent.
          </span>
          <div className="pc-row">
            <button
              className="pc-btn primary"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const cid = await save();
                  const r = await sendCampaign(cid);
                  setConfirming(false);
                  if (!r.ok) throw new Error(r.error);
                  router.push("/platform/newsletters");
                  router.refresh();
                  setMsg({ ok: true, text: r.message ?? "Sent." });
                })
              }
            >
              {pending ? "Sending…" : "Yes, send it"}
            </button>
            <button className="pc-btn" onClick={() => setConfirming(false)} disabled={pending}>
              Not yet
            </button>
          </div>
        </div>
      ) : (
        <div className="pc-row">
          <button
            className="pc-btn"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const d = await draftFromNumbers();
                if (!subject) setSubject(d.subject);
                setBody(d.body);
                setMsg({ ok: true, text: "Drafted from this month's numbers. Edit away." });
              })
            }
          >
            ✦ Draft from this month&rsquo;s numbers
          </button>
          <button
            className="pc-btn"
            disabled={pending || !subject || !body}
            onClick={() =>
              run(async () => {
                await save();
                router.refresh();
                setMsg({ ok: true, text: "Draft saved." });
              })
            }
          >
            Save draft
          </button>
          <button
            className="pc-btn"
            disabled={pending || !subject || !body}
            onClick={() =>
              run(async () => {
                const r = await sendTest({ subject, body });
                if (!r.ok) throw new Error(r.error);
                setMsg({ ok: true, text: r.message ?? "Test sent." });
              })
            }
          >
            Send me a test
          </button>
          <button className="pc-btn primary" disabled={pending || !subject || !body || audience === 0} onClick={() => setConfirming(true)}>
            Send to couples →
          </button>
        </div>
      )}
    </div>
  );
}

export function DraftRow({ id, subject, when, active }: { id: string; subject: string; when: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="pc-row" style={{ justifyContent: "space-between", padding: "8px 10px", borderRadius: 10, background: active ? "#161b25" : "transparent", border: "1px solid #232a38" }}>
      <Link href={`/platform/newsletters?edit=${id}`} style={{ textDecoration: "none", minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subject}</div>
        <div className="pc-faint">{new Date(when).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
      </Link>
      <button
        className="pc-btn small danger"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await deleteCampaign(id);
            router.push("/platform/newsletters");
            router.refresh();
          })
        }
        aria-label={`Delete draft ${subject}`}
      >
        ✕
      </button>
    </div>
  );
}
