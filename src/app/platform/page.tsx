import Link from "next/link";
import { BarChart, CountUp, Donut, LineChart } from "@/components/charts/Charts";
import { loadPlatformStats } from "@/lib/platform/stats";
import { weddingLinkFactory } from "@/lib/platform/links";

function ago(iso: string | null) {
  if (!iso) return "never";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}

export default async function PlatformOverview() {
  const [s, link] = await Promise.all([loadPlatformStats(), weddingLinkFactory()]);
  const k = s.kpis;
  const thisWeek = s.weeks.at(-1)?.actions ?? 0;
  const lastWeek = s.weeks.at(-2)?.actions ?? 0;
  const trend = lastWeek ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;
  const top = [...s.weddings].sort((a, b) => b.actions30 - a.actions30).slice(0, 6);
  const topMax = Math.max(1, ...top.map((w) => w.actions30));

  const kpis = [
    { label: "Weddings", value: k.weddings, note: `${s.weeks.slice(-4).reduce((n, w) => n + w.weddings, 0)} new in 4 weeks`, tone: "#38d6ff" },
    { label: "People with a login", value: k.accounts, note: `${k.couples} of them couples`, tone: "#9b7bff" },
    { label: "Signed in this week", value: k.active7, note: `${k.active30} this month`, tone: "#00e396" },
    { label: "Things done, 30 days", value: k.actions30, note: trend === null ? "tasks, options, comments…" : `${trend >= 0 ? "▲" : "▼"} ${Math.abs(trend)}% on last week`, tone: "#feb019" },
    { label: "Guests on lists", value: k.guests, note: `${k.replies} RSVP replies`, tone: "#ff4560" },
  ];

  return (
    <>
      <header className="pc-head">
        <div>
          <p className="pc-eyebrow">Overview</p>
          <h1 className="pc-title">How the weddings are doing</h1>
          <p className="pc-sub">Every wedding on the platform, live. Activity counts the things people make: tasks, options, comments, messages, running-order items and diary entries.</p>
        </div>
        <div className="pc-row">
          <Link className="pc-btn" href="/platform/weddings">
            All weddings
          </Link>
          <Link className="pc-btn primary" href="/platform/newsletters">
            Write a newsletter
          </Link>
        </div>
      </header>

      <section className="pc-grid-kpi" aria-label="Headline numbers">
        {kpis.map((x, i) => (
          <div key={x.label} className="pc-kpi" style={{ "--tone": x.tone, animationDelay: `${i * 70}ms` } as React.CSSProperties}>
            <div className="pc-kpi-label">{x.label}</div>
            <div className="pc-kpi-value">
              <CountUp value={x.value} />
            </div>
            <div className="pc-kpi-note">{x.note}</div>
          </div>
        ))}
      </section>

      <div className="pc-cards">
        <section className="pc-card w8" style={{ animationDelay: "150ms" }}>
          <h2>Activity, week by week</h2>
          <p className="pc-card-sub">Things made across every wedding, and new logins, over the last 12 weeks.</p>
          <LineChart
            labels={s.weeks.map((w) => w.label)}
            series={[
              { name: "Things done", values: s.weeks.map((w) => w.actions), colour: "#38d6ff" },
              { name: "New logins", values: s.weeks.map((w) => w.accounts), colour: "#ff4560" },
            ]}
          />
        </section>
        <section className="pc-card w4" style={{ animationDelay: "220ms" }}>
          <h2>How engaged are people?</h2>
          <p className="pc-card-sub">Everyone with a login, by when they last signed in.</p>
          <Donut segments={s.engagement} label="people" />
        </section>
        <section className="pc-card w6" style={{ animationDelay: "290ms" }}>
          <h2>Things done per week</h2>
          <p className="pc-card-sub">The taller the week, the warmer the bar.</p>
          <BarChart data={s.weeks.map((w) => ({ label: w.label, value: w.actions }))} />
        </section>
        <section className="pc-card w6" style={{ animationDelay: "360ms" }}>
          <h2>Busiest weddings this month</h2>
          <p className="pc-card-sub">By things done in the last 30 days.</p>
          <div className="pc-funnel">
            {top.length === 0 && <p className="pc-muted">Nothing yet.</p>}
            {top.map((w, i) => (
              <a key={w.id} href={link(w.slug, "/hub")} className="pc-funnel-row" style={{ textDecoration: "none", gridTemplateColumns: "140px minmax(0,1fr) 90px" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</span>
                <span className="pc-funnel-bar">
                  <i
                    style={{
                      width: `${(w.actions30 / topMax) * 100}%`,
                      background: `linear-gradient(90deg, #00e396, ${i === 0 ? "#ff4560" : "#feb019"})`,
                      animationDelay: `${400 + i * 90}ms`,
                    }}
                  />
                </span>
                <span className="pc-faint" style={{ textAlign: "right" }}>
                  {w.actions30} · {ago(w.lastActive)}
                </span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
