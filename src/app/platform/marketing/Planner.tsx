"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePost, savePost, setPostStatus } from "@/lib/platform/actions";

type Post = { id: string; channel: string; body: string; link: string | null; image_url: string | null; planned_for: string | null; status: string };

const CHANNEL = { facebook: "Facebook", instagram: "Instagram", both: "Facebook + Instagram" } as Record<string, string>;
const DAY = 86_400_000;

function localDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function Planner({ posts }: { posts: Post[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<Partial<Post> | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const today = localDay(new Date());
  const days = Array.from({ length: 14 }, (_, i) => new Date(today.getTime() + i * DAY));
  const onDay = (d: Date) => posts.filter((p) => p.planned_for && localDay(new Date(p.planned_for)).getTime() === d.getTime());
  const unplanned = posts.filter((p) => !p.planned_for || new Date(p.planned_for) < today);

  const toMeta = async (p: Partial<Post>) => {
    const text = [p.body, p.link].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(p.id ?? "new");
    } catch {}
    window.open("https://business.facebook.com/latest/composer", "_blank", "noopener");
  };

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setErr(null);
      const r = await fn();
      if (!r.ok) setErr(r.error ?? "Something went wrong.");
      else router.refresh();
    });

  const card = (p: Post) => (
    <div key={p.id} className={`pc-post ${p.channel}`}>
      <div style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.body}</div>
      <div className="pc-row" style={{ gap: 4, marginTop: 6 }}>
        <span className={`pc-pill ${p.status === "posted" ? "green" : p.status === "scheduled" ? "amber" : ""}`}>{p.status}</span>
        <button className="pc-btn small" onClick={() => setEditing(p)} aria-label="Edit post">
          Edit
        </button>
      </div>
    </div>
  );

  return (
    <div className="pc-cards">
      <section className="pc-card w8">
        <div className="pc-row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Next two weeks</h2>
            <p className="pc-card-sub">Violet is Facebook, rose is Instagram, amber is both.</p>
          </div>
          <button className="pc-btn primary" onClick={() => setEditing({ channel: "both", status: "idea", planned_for: new Date(today.getTime() + DAY + 10 * 3_600_000).toISOString() })}>
            + New post
          </button>
        </div>
        <div className="pc-week" style={{ marginTop: 12 }}>
          {days.map((d, i) => (
            <div key={d.toISOString()} className={`pc-day ${i === 0 ? "is-today" : ""}`}>
              <div className="pc-day-head">{d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}</div>
              {onDay(d).map(card)}
              <button
                className="pc-btn small"
                style={{ opacity: 0.6 }}
                onClick={() => setEditing({ channel: "both", status: "idea", planned_for: new Date(d.getTime() + 10 * 3_600_000).toISOString() })}
                aria-label={`Plan a post for ${d.toDateString()}`}
              >
                +
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="pc-card w4">
        {editing ? (
          <div className="pc-stack">
            <h2>{editing.id ? "Edit post" : "New post"}</h2>
            <label className="pc-field">
              Where
              <select className="pc-select" value={editing.channel ?? "both"} onChange={(e) => setEditing({ ...editing, channel: e.target.value })}>
                {Object.entries(CHANNEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="pc-field">
              Post
              <textarea className="pc-textarea" value={editing.body ?? ""} onChange={(e) => setEditing({ ...editing, body: e.target.value })} placeholder="Your wedding has a lot of moving parts…" />
              <span className="pc-faint" style={{ textAlign: "right" }}>
                {(editing.body ?? "").length} / 2,200 {editing.channel !== "facebook" && (editing.body ?? "").length > 2200 ? "· too long for Instagram" : ""}
              </span>
            </label>
            <label className="pc-field">
              Link (optional)
              <input className="pc-input" value={editing.link ?? ""} onChange={(e) => setEditing({ ...editing, link: e.target.value })} placeholder="https://…" />
            </label>
            <label className="pc-field">
              Planned for
              <input
                className="pc-input"
                type="datetime-local"
                value={editing.planned_for ? toLocalInput(editing.planned_for) : ""}
                onChange={(e) => setEditing({ ...editing, planned_for: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </label>
            <label className="pc-field">
              Status
              <select className="pc-select" value={editing.status ?? "idea"} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                <option value="idea">Idea</option>
                <option value="scheduled">Scheduled in Meta</option>
                <option value="posted">Posted</option>
              </select>
            </label>
            {err && <p className="pc-note bad">{err}</p>}
            {copied && <p className="pc-note">Copied. Paste it into the Meta composer that just opened, pick the time, and schedule.</p>}
            <div className="pc-row">
              <button
                className="pc-btn primary"
                disabled={pending || !editing.body}
                onClick={() =>
                  act(async () => {
                    const r = await savePost({ ...editing, body: editing.body ?? "", channel: editing.channel ?? "both" } as Parameters<typeof savePost>[0]);
                    if (r.ok) setEditing(null);
                    return r;
                  })
                }
              >
                Save
              </button>
              <button className="pc-btn" disabled={!editing.body} onClick={() => toMeta(editing)}>
                Schedule in Meta ↗
              </button>
              {editing.id && (
                <>
                  {editing.status !== "posted" && (
                    <button className="pc-btn" disabled={pending} onClick={() => act(async () => {
                        const next = editing.status === "idea" ? "scheduled" : "posted";
                        setEditing(null);
                        return setPostStatus(editing.id!, next);
                      })}>
                      Mark {editing.status === "idea" ? "scheduled" : "posted"}
                    </button>
                  )}
                  <button className="pc-btn danger" disabled={pending} onClick={() => act(async () => {
                        setEditing(null);
                        return deletePost(editing.id!);
                      })}>
                    Delete
                  </button>
                </>
              )}
              <button className="pc-btn" onClick={() => (setEditing(null), setCopied(null))}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="pc-stack">
            <h2>Ideas and past posts</h2>
            <p className="pc-card-sub" style={{ margin: 0 }}>
              No date yet, or the date has gone.
            </p>
            {unplanned.length === 0 && <p className="pc-faint">Nothing here. Use + New post to start one.</p>}
            {unplanned.map(card)}
          </div>
        )}
      </section>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function UtmBuilder({ base }: { base: string }) {
  const [url, setUrl] = useState(base);
  const [source, setSource] = useState("instagram");
  const [medium, setMedium] = useState("social");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);
  let out = url;
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", source);
    u.searchParams.set("utm_medium", medium);
    if (campaign) u.searchParams.set("utm_campaign", campaign.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    out = u.toString();
  } catch {}
  return (
    <div className="pc-stack">
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <label className="pc-field">
          Page
          <input className="pc-input" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label className="pc-field">
          Source
          <select className="pc-select" value={source} onChange={(e) => setSource(e.target.value)}>
            {["instagram", "facebook", "newsletter", "tiktok", "pinterest", "word-of-mouth"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="pc-field">
          Type
          <select className="pc-select" value={medium} onChange={(e) => setMedium(e.target.value)}>
            {["social", "email", "paid", "referral"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="pc-field">
          Campaign
          <input className="pc-input" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="spring launch" />
        </label>
      </div>
      <div className="pc-row">
        <code style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", padding: "10px 12px", borderRadius: 10, background: "#0a0c11", border: "1px solid #232a38", fontSize: 12 }}>{out}</code>
        <button
          className="pc-btn primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(out);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {}
          }}
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
