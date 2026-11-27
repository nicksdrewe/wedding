import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";
import { Botanical } from "@/components/Botanical";
import { siteBase } from "@/lib/commercial/base";
import { PRICE, SITE_NAME, SITE_URL } from "@/lib/commercial/pricing";
import { AddressBar } from "./_components/AddressBar";
import { PaletteDemo } from "./_components/PaletteDemo";
import { SiteHeader, SiteFooter } from "./_components/Chrome";
import { FAQ } from "./_components/faq";

export const dynamic = "force-dynamic";

const INCLUDED = [
  "Your own address: you.weddingsweddings.co.uk",
  "Guest list, households and plus ones",
  "RSVPs for every event, with dietary needs",
  "Planning boards for venue, food, flowers and the rest",
  "Budget, costs and who's paying for what",
  "Diary, tasks and reminders",
  "Emails and updates to guests, from your site",
  "Wedding party pages: stag, hen, speeches",
  "The day itself: running order for everyone",
  "Five colour palettes, day or night garden",
  "Everyone signs in with an emailed code",
  "No adverts. Your guests' details stay yours",
];

export default async function CommercialHome() {
  const base = await siteBase();
  const start = `${base}/start`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/brand/weddings-weddings-app-icon.svg`,
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: `${SITE_NAME} wedding website`,
      description:
        "A private website for one wedding: guest list, RSVPs, planning, budget, messages and the day's running order, at the couple's own address.",
      brand: { "@type": "Brand", name: SITE_NAME },
      offers: {
        "@type": "Offer",
        price: PRICE.amount,
        priceCurrency: PRICE.currency,
        availability: "https://schema.org/PreOrder",
        url: `${SITE_URL}/start`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader base={base} />

      <main id="top">
        {/* ── hero ─────────────────────────────────────────── */}
        <section className="ww-hero">
          <Botanical seed={3} stems={4} width={220} height={360} spread={60} className="ww-hero-flora ww-hero-flora-l" />
          <Botanical seed={11} stems={3} width={180} height={300} spread={50} className="ww-hero-flora ww-hero-flora-r" />
          <div className="ww-wrap ww-hero-grid">
            <div className="ww-hero-copy">
              <p className="ww-eyebrow">
                <span className="ww-pill">Alpha</span> Now open to invited couples
              </p>
              <h1 className="ww-h1">
                Your whole wedding, <em>at your own address.</em>
              </h1>
              <p className="ww-lede">
                One private site with your names on it. Guests RSVP, you plan, the wedding party gets their own corner, and on the
                day everyone knows where to be.
              </p>
              <div className="ww-cta-row">
                <Link href={start} className="ww-btn ww-btn-primary">
                  Start your wedding site
                </Link>
                <a href="#inside" className="ww-btn ww-btn-ghost">
                  See what&rsquo;s inside
                </a>
              </div>
              <p className="ww-fine">
                {PRICE.label} {PRICE.per}. No subscription.
              </p>
            </div>
            <AddressBar />
          </div>
        </section>

        {/* ── what's inside ────────────────────────────────── */}
        <section id="inside" className="ww-section">
          <div className="ww-wrap">
            <p className="ww-kicker">What&rsquo;s inside</p>
            <h2 className="ww-h2">Everything the wedding needs, and nothing it doesn&rsquo;t.</h2>
            <p className="ww-sub">
              Six parts, each with its own colour, so you always know where you are. Everyone sees only what you let them.
            </p>

            <div className="ww-bento">
              <article className="ww-tile ww-tile-people ww-tile-wide">
                <div>
                  <h3>Guests &amp; RSVPs</h3>
                  <p>Households, plus ones and dietary needs. Guests answer for each event, and you see the count change live.</p>
                </div>
                <div className="ww-mock ww-mock-rsvp" aria-hidden="true">
                  <div className="ww-mock-row"><span className="ww-dot" />Aunt Jo &amp; Pete<b className="yes">Attending</b></div>
                  <div className="ww-mock-row"><span className="ww-dot" />The Okafors (4)<b className="yes">Attending</b></div>
                  <div className="ww-mock-row"><span className="ww-dot" />Sam Reid +1<b className="wait">Waiting</b></div>
                  <div className="ww-mock-row"><span className="ww-dot" />Grandma Rose<b className="no">Can&rsquo;t make it</b></div>
                  <div className="ww-mock-count"><strong>86</strong> of 112 replied</div>
                </div>
              </article>

              <article className="ww-tile ww-tile-planning">
                <h3>Planning boards</h3>
                <p>Venues, caterers, florists: options side by side, with costs, photos, pins on a map and a vote.</p>
                <div className="ww-mock ww-mock-board" aria-hidden="true">
                  <span>Venue</span>
                  <i><b>The Old Barn</b><em>£8,400</em></i>
                  <i className="pick"><b>Hill House</b><em>£9,100 ♥ 3</em></i>
                </div>
              </article>

              <article className="ww-tile ww-tile-money">
                <h3>Budget</h3>
                <p>What it costs, what&rsquo;s paid, and who&rsquo;s chipping in.</p>
                <div className="ww-mock ww-mock-bars" aria-hidden="true">
                  <span style={{ ["--w" as string]: "82%" }}>Venue</span>
                  <span style={{ ["--w" as string]: "54%" }}>Food</span>
                  <span style={{ ["--w" as string]: "31%" }}>Flowers</span>
                  <span style={{ ["--w" as string]: "18%" }}>Music</span>
                </div>
              </article>

              <article className="ww-tile ww-tile-diary">
                <h3>Diary &amp; tasks</h3>
                <p>Deadlines, fittings and tastings, with reminders to whoever&rsquo;s on it.</p>
                <div className="ww-mock ww-mock-cal" aria-hidden="true">
                  {Array.from({ length: 21 }, (_, i) => (
                    <span key={i} className={i === 9 ? "on" : i === 15 ? "soft" : ""} />
                  ))}
                </div>
              </article>

              <article className="ww-tile ww-tile-comms">
                <h3>Messages</h3>
                <p>Save the dates and updates, emailed from your own site, to everyone or just the coach party.</p>
                <div className="ww-mock ww-mock-mail" aria-hidden="true">
                  <b>To: Everyone (112)</b>
                  <span>Coaches leave the hotel at 1.30pm…</span>
                </div>
              </article>

              <article className="ww-tile ww-tile-party ww-tile-wide">
                <div>
                  <h3>The wedding party, and the day itself</h3>
                  <p>
                    The best man plans the stag without you seeing it. On the day, everyone has the running order on their phone,
                    and the photos land in one place.
                  </p>
                </div>
                <ol className="ww-mock ww-mock-day" aria-hidden="true">
                  <li><time>13:30</time>Coaches leave</li>
                  <li><time>14:00</time>Ceremony</li>
                  <li className="now"><time>15:15</time>Drinks on the lawn</li>
                  <li><time>17:30</time>Dinner &amp; speeches</li>
                </ol>
              </article>
            </div>
          </div>
        </section>

        {/* ── make it yours ────────────────────────────────── */}
        <section id="yours" className="ww-section ww-section-tint">
          <div className="ww-wrap ww-split">
            <div>
              <p className="ww-kicker">Make it yours</p>
              <h2 className="ww-h2">Your names, your colours, day or night.</h2>
              <p className="ww-sub">
                Pick from five palettes drawn from real gardens and seasons, and switch to a night garden for an evening do. Your
                names run through every page, every email and the app on your guests&rsquo; phones.
              </p>
            </div>
            <PaletteDemo />
          </div>
        </section>

        {/* ── how it works ─────────────────────────────────── */}
        <section id="how" className="ww-section">
          <div className="ww-wrap">
            <p className="ww-kicker">How it works</p>
            <h2 className="ww-h2">Set up in an evening. Useful for the whole engagement.</h2>
            <ol className="ww-steps">
              <li>
                <span className="ww-step-n">1</span>
                <h3>Choose your address</h3>
                <p>Your names make the address, like jonsarah.weddingsweddings.co.uk. Pay once and it&rsquo;s yours.</p>
              </li>
              <li>
                <span className="ww-step-n">2</span>
                <h3>Add your people</h3>
                <p>Bring in your guest list, set who sees what, and invite family and the wedding party to help.</p>
              </li>
              <li>
                <span className="ww-step-n">3</span>
                <h3>Plan, then celebrate</h3>
                <p>Collect RSVPs, compare suppliers, keep the budget honest, and share the running order on the day.</p>
              </li>
            </ol>
          </div>
        </section>

        {/* ── pricing ──────────────────────────────────────── */}
        <section id="pricing" className="ww-section ww-section-tint">
          <div className="ww-wrap ww-pricing">
            <div>
              <p className="ww-kicker">Pricing</p>
              <h2 className="ww-h2">One price. Paid once.</h2>
              <p className="ww-sub">
                No monthly fee, no per-guest charges, no upgrades to unlock the useful bits.
              </p>
            </div>
            <div className="ww-price-card">
              <Botanical seed={21} stems={2} width={120} height={180} spread={30} className="ww-price-flora" />
              <p className="ww-price-name">One wedding</p>
              <p className="ww-price">
                {PRICE.label}
                <span>{PRICE.per}</span>
              </p>
              <ul className="ww-ticks">
                {INCLUDED.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <Link href={start} className="ww-btn ww-btn-primary ww-btn-block">
                Start your wedding site
              </Link>
              <p className="ww-fine ww-center">In alpha: free with an invite code.</p>
            </div>
          </div>
        </section>

        {/* ── questions ────────────────────────────────────── */}
        <section id="faq" className="ww-section">
          <div className="ww-wrap ww-narrow">
            <p className="ww-kicker">Questions</p>
            <h2 className="ww-h2">Good to know</h2>
            <div className="ww-faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── last word ────────────────────────────────────── */}
        <section className="ww-final">
          <div className="ww-wrap ww-final-inner">
            <LogoMark size={64} tone="light" />
            <h2 className="ww-h2">Make the site. Then go and enjoy being engaged.</h2>
            <Link href={start} className="ww-btn ww-btn-light">
              Start your wedding site
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter base={base} />
    </>
  );
}
