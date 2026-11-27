import { createAdminClient } from "@/lib/supabase/admin";
import { BarChart, CountUp } from "@/components/charts/Charts";
import { audienceSize } from "@/lib/platform/actions";
import { Composer, DraftRow } from "./Composer";

type Campaign = { id: string; subject: string; body: string; status: string; sent_at: string | null; recipients: number; created_at: string };

const KINDS = [
  { kind: "sent", label: "Sent", colour: "#38d6ff" },
  { kind: "delivered", label: "Delivered", colour: "#9b7bff" },
  { kind: "opened", label: "Opened", colour: "#00e396" },
  { kind: "clicked", label: "Clicked", colour: "#feb019" },
  { kind: "bounced", label: "Bounced", colour: "#ff4560" },
] as const;

export default async function PlatformNewsletters({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const admin = createAdminClient();
  const [{ data: campaigns, error }, { data: events }, size] = await Promise.all([
    admin.from("platform_campaigns").select("*").order("created_at", { ascending: false }),
    admin.from("platform_campaign_events").select("campaign_id, email, kind"),
    audienceSize().catch(() => 0),
  ]);
  const list = (campaigns ?? []) as Campaign[];
  // unique people per kind, per newsletter
  const stats = new Map<string, Record<string, number>>();
  const seen = new Set<string>();
  for (const e of events ?? []) {
    const k = `${e.campaign_id}|${e.kind}|${e.email}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const m = stats.get(e.campaign_id) ?? {};
    m[e.kind] = (m[e.kind] ?? 0) + 1;
    stats.set(e.campaign_id, m);
  }
  const sent = list.filter((c) => c.status === "sent");
  const drafts = list.filter((c) => c.status === "draft");
  const editing = drafts.find((d) => d.id === edit) ?? null;
  const rate = (c: Campaign, kind: string) => {
    const m = stats.get(c.id) ?? {};
    const base = m.delivered || m.sent || c.recipients || 0;
    return base ? Math.round(((m[kind] ?? 0) / base) * 100) : 0;
  };
  const avgOpen = sent.length ? Math.round(sent.reduce((n, c) => n + rate(c, "opened"), 0) / sent.length) : 0;
  const avgClick = sent.length ? Math.round(sent.reduce((n, c) => n + rate(c, "clicked"), 0) / sent.length) : 0;

  return (
    <>
      <header className="pc-head">
        <div>
          <p className="pc-eyebrow">Newsletters</p>
          <h1 className="pc-title">Write to every couple</h1>
          <p className="pc-sub">
            Goes to the couple on every wedding ({size} address{size === 1 ? "" : "es"} right now, less anyone who&rsquo;s unsubscribed). Each one carries an unsubscribe link, and opens and clicks
            come back here from Resend.
          </p>
        </div>
      </header>

      {error && <p className="pc-note bad">The newsletter tables aren&rsquo;t there yet: run migration 0065 on the database. ({error.message})</p>}

      <section className="pc-grid-kpi">
        {[
          { label: "Newsletters sent", v: sent.length, tone: "#38d6ff", suffix: "" },
          { label: "Average open rate", v: avgOpen, tone: "#00e396", suffix: "%" },
          { label: "Average click rate", v: avgClick, tone: "#feb019", suffix: "%" },
          { label: "Couples reachable", v: size, tone: "#9b7bff", suffix: "" },
        ].map((x, i) => (
          <div key={x.label} className="pc-kpi" style={{ "--tone": x.tone, animationDelay: `${i * 70}ms` } as React.CSSProperties}>
            <div className="pc-kpi-label">{x.label}</div>
            <div className="pc-kpi-value">
              <CountUp value={x.v} />
              {x.suffix}
            </div>
          </div>
        ))}
      </section>

      <div className="pc-cards">
        <section className="pc-card w8">
          <h2>{editing ? "Edit draft" : "New newsletter"}</h2>
          <p className="pc-card-sub">Plain writing: a blank line starts a paragraph, &ldquo;# &rdquo; a heading, &ldquo;- &rdquo; a list, **bold**, [words](https://link).</p>
          <Composer key={editing?.id ?? "new"} draft={editing ? { id: editing.id, subject: editing.subject, body: editing.body } : null} audience={size} />
        </section>
        <section className="pc-card w4">
          <h2>Drafts</h2>
          <p className="pc-card-sub">Saved but not sent.</p>
          <div className="pc-stack" style={{ gap: 8 }}>
            {drafts.length === 0 && <p className="pc-faint">None.</p>}
            {drafts.map((d) => (
              <DraftRow key={d.id} id={d.id} subject={d.subject} when={d.created_at} active={d.id === edit} />
            ))}
          </div>
        </section>

        {sent.length > 0 && (
          <section className="pc-card">
            <h2>Open rate by newsletter</h2>
            <p className="pc-card-sub">Share of delivered emails that were opened.</p>
            <BarChart unit="%" data={[...sent].reverse().map((c) => ({ label: c.subject.length > 14 ? `${c.subject.slice(0, 13)}…` : c.subject, value: rate(c, "opened") }))} />
          </section>
        )}

        {sent.map((c, i) => {
          const m = stats.get(c.id) ?? {};
          const base = Math.max(1, c.recipients, m.sent ?? 0);
          return (
            <section key={c.id} className="pc-card w6" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="pc-row" style={{ justifyContent: "space-between" }}>
                <h2 style={{ margin: 0 }}>{c.subject}</h2>
                <span className="pc-pill green">Sent</span>
              </div>
              <p className="pc-card-sub" style={{ marginTop: 4 }}>
                {c.sent_at ? new Date(c.sent_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""} · {c.recipients} recipients
              </p>
              <div className="pc-funnel">
                {KINDS.map((k, j) => (
                  <div key={k.kind} className="pc-funnel-row">
                    <span className="pc-muted">{k.label}</span>
                    <span className="pc-funnel-bar">
                      <i style={{ width: `${((m[k.kind] ?? 0) / base) * 100}%`, background: k.colour, boxShadow: `0 0 calc(10px * var(--pc-glow)) ${k.colour}`, animationDelay: `${j * 120}ms` }} />
                    </span>
                    <span style={{ textAlign: "right" }}>
                      {m[k.kind] ?? 0} <span className="pc-faint">{Math.round(((m[k.kind] ?? 0) / base) * 100)}%</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
