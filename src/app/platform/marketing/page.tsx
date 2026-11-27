import { createAdminClient } from "@/lib/supabase/admin";
import { ROOT_DOMAIN } from "@/lib/wedding/host";
import { CountUp } from "@/components/charts/Charts";
import { Planner, UtmBuilder } from "./Planner";

export default async function PlatformMarketing() {
  const { data: posts, error } = await createAdminClient().from("platform_social_posts").select("*").order("planned_for", { ascending: true, nullsFirst: false });
  const list = (posts ?? []) as { id: string; channel: string; body: string; link: string | null; image_url: string | null; planned_for: string | null; status: string }[];
  const n = (s: string) => list.filter((p) => p.status === s).length;
  return (
    <>
      <header className="pc-head">
        <div>
          <p className="pc-eyebrow">Marketing</p>
          <h1 className="pc-title">Plan the posts, let Meta post them</h1>
          <p className="pc-sub">
            Write and line up Facebook and Instagram posts here. &ldquo;Schedule in Meta&rdquo; copies the words and opens Meta Business Suite&rsquo;s composer, which schedules to both for free.
            Mark it scheduled once it&rsquo;s in.
          </p>
        </div>
        <div className="pc-row">
          <a className="pc-btn" href="https://business.facebook.com/latest/content_calendar" target="_blank" rel="noreferrer">
            Meta calendar ↗
          </a>
          <a className="pc-btn primary" href="https://business.facebook.com/latest/composer" target="_blank" rel="noreferrer">
            Open Meta composer ↗
          </a>
        </div>
      </header>

      {error && <p className="pc-note bad">The planner table isn&rsquo;t there yet: run migration 0065. ({error.message})</p>}

      <section className="pc-grid-kpi">
        {[
          { label: "Ideas", v: n("idea"), tone: "#9b7bff" },
          { label: "Scheduled in Meta", v: n("scheduled"), tone: "#feb019" },
          { label: "Posted", v: n("posted"), tone: "#00e396" },
        ].map((x, i) => (
          <div key={x.label} className="pc-kpi" style={{ "--tone": x.tone, animationDelay: `${i * 70}ms` } as React.CSSProperties}>
            <div className="pc-kpi-label">{x.label}</div>
            <div className="pc-kpi-value">
              <CountUp value={x.v} />
            </div>
          </div>
        ))}
      </section>

      <Planner posts={list} />

      <div className="pc-cards" style={{ marginTop: 14 }}>
        <section className="pc-card">
          <h2>Tracked links</h2>
          <p className="pc-card-sub">Add these tags to links in posts and newsletters so visits show where they came from in your analytics.</p>
          <UtmBuilder base={`https://${ROOT_DOMAIN}/`} />
        </section>
      </div>
    </>
  );
}
