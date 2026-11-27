import Link from "next/link";
import { CountUp } from "@/components/charts/Charts";
import { loadPlatformStats, type WeddingRow } from "@/lib/platform/stats";
import { weddingLinkFactory } from "@/lib/platform/links";

const SORTS: Record<string, { label: string; by: (a: WeddingRow, b: WeddingRow) => number }> = {
  newest: { label: "Started", by: (a, b) => b.createdAt.localeCompare(a.createdAt) },
  busy: { label: "Things done", by: (a, b) => b.actions30 - a.actions30 },
  people: { label: "People", by: (a, b) => b.people - a.people },
  active: { label: "Last seen", by: (a, b) => (b.lastActive ?? "").localeCompare(a.lastActive ?? "") },
  name: { label: "Wedding", by: (a, b) => a.name.localeCompare(b.name) },
};

function ago(iso: string | null) {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d;
}

function health(w: WeddingRow) {
  const d = ago(w.lastActive);
  if (d === null) return { tone: "rose", label: "Not signed in yet" };
  if (d <= 7) return { tone: "green", label: "Active" };
  if (d <= 30) return { tone: "amber", label: "Drifting" };
  return { tone: "rose", label: "Gone quiet" };
}

export default async function PlatformWeddings({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort = "newest" } = await searchParams;
  const [s, link] = await Promise.all([loadPlatformStats(), weddingLinkFactory()]);
  const rows = [...s.weddings].sort((SORTS[sort] ?? SORTS.newest).by);
  const max = Math.max(1, ...rows.map((r) => r.actions30));
  const counts = rows.reduce(
    (m, w) => {
      m[health(w).tone]++;
      return m;
    },
    { green: 0, amber: 0, rose: 0 } as Record<string, number>
  );

  const th = (key: string, label?: string) => (
    <th>
      <Link href={`/platform/weddings?sort=${key}`} className={sort === key ? "is-on" : ""} scroll={false}>
        {label ?? SORTS[key].label}
        {sort === key ? " ↓" : ""}
      </Link>
    </th>
  );

  return (
    <>
      <header className="pc-head">
        <div>
          <p className="pc-eyebrow">Weddings</p>
          <h1 className="pc-title">Every wedding, and who&rsquo;s using it</h1>
          <p className="pc-sub">People counts everyone on the list; logins are the ones who&rsquo;ve signed in. &ldquo;Things done&rdquo; covers the last 30 days.</p>
        </div>
      </header>

      <section className="pc-grid-kpi">
        {[
          { label: "Active this week", v: counts.green, tone: "#00e396" },
          { label: "Drifting (8–30 days)", v: counts.amber, tone: "#feb019" },
          { label: "Quiet or not started", v: counts.rose, tone: "#ff4560" },
        ].map((x, i) => (
          <div key={x.label} className="pc-kpi" style={{ "--tone": x.tone, animationDelay: `${i * 70}ms` } as React.CSSProperties}>
            <div className="pc-kpi-label">{x.label}</div>
            <div className="pc-kpi-value">
              <CountUp value={x.v} />
            </div>
          </div>
        ))}
      </section>

      <section className="pc-card">
        <div className="pc-table-wrap">
          <table className="pc-table">
            <thead>
              <tr>
                {th("name")}
                <th>Status</th>
                {th("people")}
                <th>Logins</th>
                <th>RSVPs</th>
                {th("busy")}
                {th("active")}
                {th("newest")}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((w, i) => {
                const h = health(w);
                const d = ago(w.lastActive);
                return (
                  <tr key={w.id} style={{ animationDelay: `${Math.min(i, 20) * 35}ms` }}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{w.name}</div>
                      <div className="pc-faint">
                        {w.slug}
                        {w.dateLabel ? ` · ${w.dateLabel}` : ""}
                        {w.examples ? " · examples on" : ""}
                      </div>
                    </td>
                    <td>
                      <span className={`pc-pill ${h.tone}`}>{h.label}</span>
                      {w.status !== "active" && <span className="pc-pill" style={{ marginLeft: 6 }}>{w.status}</span>}
                    </td>
                    <td>
                      {w.people}
                      <div className="pc-faint">
                        {w.couples} couple · {w.guests} guests
                      </div>
                    </td>
                    <td>{w.signedIn}</td>
                    <td>
                      <span style={{ color: "var(--pc-green)" }}>{w.attending}</span> <span className="pc-faint">/</span> <span style={{ color: "var(--pc-rose)" }}>{w.declined}</span>
                    </td>
                    <td>
                      <div className="pc-row" style={{ gap: 8, flexWrap: "nowrap" }}>
                        <span className="pc-meter">
                          <i style={{ width: `${(w.actions30 / max) * 100}%`, animationDelay: `${200 + Math.min(i, 20) * 35}ms` }} />
                        </span>
                        {w.actions30}
                      </div>
                    </td>
                    <td className="pc-muted">{d === null ? "never" : d === 0 ? "today" : `${d}d ago`}</td>
                    <td className="pc-muted">{new Date(w.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}</td>
                    <td>
                      <a className="pc-btn small" href={link(w.slug, "/hub")} target="_blank" rel="noreferrer">
                        Open ↗
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
