import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";
import { Botanical } from "@/components/Botanical";
import { siteBase } from "@/lib/commercial/base";
import { SITE_NAME, SITE_URL } from "@/lib/commercial/pricing";
import { SiteHeader, SiteFooter } from "./_components/Chrome";
import { FAQ } from "./_components/faq";
import { SystemDemo } from "./_components/SystemDemo";
import { Magnetic, Reveal, Sunlight } from "./_components/Interactive";
import { getCopy } from "@/lib/commercial/copy";
import { BoardScene, BudgetScene, DayScene, GuestsScene, MessagesScene, PartyScene, TreeScene } from "./_components/Scenes";

export const dynamic = "force-dynamic";

const CHAPTERS = [
  {
    key: "board",
    colour: "sage",
    kicker: "Planning boards",
    points: ["Photos, prices and map pins", "Votes and comments from family", "Winners lock into the budget"],
    Scene: BoardScene,
  },
  {
    key: "tree",
    colour: "plum",
    kicker: "The whole picture",
    points: ["Decided, deciding, not started", "Costs rolled up at every level", "Branches for the stag and hen too"],
    Scene: TreeScene,
  },
  {
    key: "budget",
    colour: "gold",
    kicker: "Budget",
    points: ["Estimates, then actuals", "Who's contributing what", "Group costs split fairly"],
    Scene: BudgetScene,
  },
  {
    key: "guests",
    colour: "rose",
    kicker: "Guests & RSVPs",
    points: ["RSVPs per event", "Plus ones and dietary needs", "No passwords for guests"],
    Scene: GuestsScene,
  },
  {
    key: "party",
    colour: "plum",
    kicker: "The wedding party",
    points: ["Private boards for stag and hen", "Access by role or by person", "Prices shown only where you want"],
    Scene: PartyScene,
  },
  {
    key: "messages",
    colour: "teal",
    kicker: "Messages",
    points: ["Your names, your address", "Send to exactly the right people", "Replies collected in one inbox"],
    Scene: MessagesScene,
  },
  {
    key: "day",
    colour: "blue",
    kicker: "The day itself",
    points: ["A running order on every phone", "Notifications when plans change", "Works like an app, no download"],
    Scene: DayScene,
  },
] as const;

const BREADTH = [
  "Diary and deadlines",
  "Tasks with reminders",
  "Phone notifications",
  "Add to your home screen",
  "Idea boards",
  "A gift list guests can claim",
  "Your wedding fund details",
  "Engagement party pages",
  "An access code for the whole site",
  "Couple, family, wedding party and guest roles",
  "Page-by-page permissions",
  "Hide prices from some people",
  "See the site as any guest",
  "One sign-in for every wedding you're part of",
  "Your names on every page",
  "Your own web address",
  "Map pins for every venue",
  "Comments on every option",
  "Expense splitting",
  "Day and night looks",
];

const ROLES = [
  {
    who: "The two of you",
    line: "Everything, everywhere.",
    detail: "Every board, every cost, every guest and every setting. You decide what everyone else sees.",
  },
  {
    who: "Family",
    line: "In on the planning, if you want them.",
    detail: "Options, votes, comments and the budget, without the parts you'd rather keep to yourselves.",
  },
  {
    who: "Wedding party",
    line: "Their own corner.",
    detail: "Private boards for the stag and hen, their tasks, their bit of the day. Their surprises stay surprises.",
  },
  {
    who: "Guests",
    line: "Exactly what they need.",
    detail: "Reply for each event, see the plan for the day, find the gift list. Nothing to install, nothing to remember.",
  },
];

export default async function CommercialHome() {
  const base = await siteBase();
  const start = `${base}/start`;
  const c = await getCopy();

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
      "@type": "WebApplication",
      name: SITE_NAME,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Any (web)",
      url: SITE_URL,
      description:
        "A private website for one wedding that runs the planning as well as the RSVPs: guest list, planning boards with votes and comments, budget, tasks, messages to guests and the running order on the day.",
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
          <Sunlight />
          <Botanical seed={3} stems={4} width={220} height={360} spread={60} className="ww-hero-flora ww-hero-flora-l" />
          <div className="ww-wrap ww-hero-grid">
            <div className="ww-hero-copy">
              <p className="ww-eyebrow">
                <span className="ww-pill">Alpha</span> {c("hero.eyebrow")}
              </p>
              <h1 className="ww-h1">
                {c("hero.title")}
                <em>{c("hero.titleItalic")}</em>
              </h1>
              <p className="ww-lede">{c("hero.lede")}</p>
              <div className="ww-cta-row">
                <Magnetic>
                  <Link href={start} className="ww-btn ww-btn-primary ww-btn-shine">
                    {c("hero.cta")}
                    <span className="ww-arrow" aria-hidden="true">→</span>
                  </Link>
                </Magnetic>
                <a href="#system" className="ww-btn ww-btn-ghost">
                  {c("hero.cta2")}
                </a>
              </div>
              <p className="ww-fine">{c("hero.fine")}</p>
            </div>
            <div id="system">
              <SystemDemo />
            </div>
          </div>
        </section>

        {/* ── the gap ──────────────────────────────────────── */}
        <section className="ww-section ww-dark">
          <div className="ww-wrap">
            <Reveal>
              <p className="ww-kicker">Why this exists</p>
              <h2 className="ww-h2">{c("why.title")}</h2>
              <p className="ww-sub">{c("why.body")}</p>
            </Reveal>
            <div className="ww-compare">
              <Reveal className="ww-compare-col ww-compare-them">
                <p className="ww-compare-head">A typical wedding website</p>
                <ul>
                  <li>A page about the two of you</li>
                  <li>An RSVP form</li>
                  <li>A link to a gift list</li>
                  <li>Then you&rsquo;re back in the spreadsheet</li>
                </ul>
              </Reveal>
              <Reveal className="ww-compare-col ww-compare-us" delay={120}>
                <p className="ww-compare-head">
                  <LogoMark size={22} tone="light" /> Weddings Weddings
                </p>
                <ul>
                  <li>All of that, at your own address</li>
                  <li>RSVPs for every event, with dietary needs</li>
                  <li>Planning boards with votes, comments and winners</li>
                  <li>A budget that fills itself as you decide</li>
                  <li>Tasks, deadlines and reminders for the people helping</li>
                  <li>Private boards for the stag and hen</li>
                  <li>Emails from your own address, replies collected</li>
                  <li>The running order on every phone on the day</li>
                </ul>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── the parts ────────────────────────────────────── */}
        <section id="inside" className="ww-section">
          <div className="ww-wrap">
            <Reveal>
              <p className="ww-kicker">What&rsquo;s inside</p>
              <h2 className="ww-h2">{c("inside.title")}</h2>
              <p className="ww-sub">{c("inside.body")}</p>
            </Reveal>

            <div className="ww-chapters">
              {CHAPTERS.map((ch, i) => (
                <Reveal key={ch.key} className={`ww-chapter ${i % 2 ? "flip" : ""}`}>
                  <div className={`ww-chapter-art tone-${ch.colour}`}>
                    <ch.Scene />
                  </div>
                  <div className={`ww-chapter-copy tone-${ch.colour}`}>
                    <p className="ww-chapter-kicker">{ch.kicker}</p>
                    <h3>{c(`chapter.${ch.key}.title`)}</h3>
                    <p>{c(`chapter.${ch.key}.body`)}</p>
                    <ul>
                      {ch.points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── breadth ──────────────────────────────────────── */}
        <section className="ww-section ww-breadth" aria-label="Everything else that's included">
          <div className="ww-wrap">
            <Reveal>
              <p className="ww-kicker">And the rest</p>
              <h2 className="ww-h2">{c("breadth.title")}</h2>
            </Reveal>
          </div>
          <div className="ww-marquee" aria-hidden="true">
            <div className="ww-marquee-row">
              {[...BREADTH.slice(0, 10), ...BREADTH.slice(0, 10)].map((b, i) => (
                <span key={i}>{b}</span>
              ))}
            </div>
            <div className="ww-marquee-row rev">
              {[...BREADTH.slice(10), ...BREADTH.slice(10)].map((b, i) => (
                <span key={i}>{b}</span>
              ))}
            </div>
          </div>
          <ul className="ww-sr-only">
            {BREADTH.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>

        {/* ── who sees what ────────────────────────────────── */}
        <section className="ww-section ww-section-tint">
          <div className="ww-wrap">
            <Reveal>
              <p className="ww-kicker">For everyone involved</p>
              <h2 className="ww-h2">{c("roles.title")}</h2>
              <p className="ww-sub">One site, four very different views of it. Hover to see what each person gets.</p>
            </Reveal>
            <div className="ww-roles">
              {ROLES.map((r, i) => (
                <Reveal key={r.who} delay={i * 80} className="ww-role">
                  <p className="ww-role-who">{r.who}</p>
                  <p className="ww-role-line">{r.line}</p>
                  <p className="ww-role-detail">{r.detail}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── how it starts ────────────────────────────────── */}
        <section id="how" className="ww-section">
          <div className="ww-wrap">
            <Reveal>
              <p className="ww-kicker">Getting going</p>
              <h2 className="ww-h2">{c("steps.title")}</h2>
            </Reveal>
            <ol className="ww-steps">
              {[
                ["Claim your address", "Your names make your address, like jonsarah.weddingsweddings.co.uk. It's yours from the moment you sign up."],
                ["Bring your people", "Add your guests, then invite the helpers: parents, the best man, the bridesmaids. Decide what each of them can see."],
                ["Plan it together", "Put the options up, let people weigh in, choose, and watch the budget and the plan take shape around you."],
              ].map(([t, b], i) => (
                <Reveal key={t} delay={i * 100} className="ww-step">
                  <span className="ww-step-n">{i + 1}</span>
                  <h3>{t}</h3>
                  <p>{b}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ── alpha ────────────────────────────────────────── */}
        <section id="alpha" className="ww-section ww-section-tint">
          <div className="ww-wrap ww-alpha">
            <Reveal>
              <p className="ww-kicker">The alpha</p>
              <h2 className="ww-h2">{c("alpha.title")}</h2>
              <p className="ww-sub">{c("alpha.body")}</p>
            </Reveal>
            <Reveal className="ww-alpha-card" delay={120}>
              <Botanical seed={21} stems={2} width={120} height={180} spread={30} className="ww-alpha-flora" />
              <p className="ww-alpha-title">Got an invite code?</p>
              <p className="ww-alpha-body">Your site is ready in about a minute. You can change the names, date and look whenever you like.</p>
              <Magnetic strength={6}>
                <Link href={start} className="ww-btn ww-btn-primary ww-btn-shine ww-btn-block">
                  Start your wedding site
                </Link>
              </Magnetic>
              <p className="ww-fine ww-center">No code yet? Ask the couple who told you about us.</p>
            </Reveal>
          </div>
        </section>

        {/* ── questions ────────────────────────────────────── */}
        <section id="faq" className="ww-section">
          <div className="ww-wrap ww-narrow">
            <Reveal>
              <p className="ww-kicker">Questions</p>
              <h2 className="ww-h2">Good to know</h2>
            </Reveal>
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
          <Sunlight />
          <div className="ww-wrap ww-final-inner">
            <LogoMark size={64} tone="light" />
            <h2 className="ww-h2">{c("final.title")}</h2>
            <Magnetic>
              <Link href={start} className="ww-btn ww-btn-light ww-btn-shine">
                Start your wedding site
              </Link>
            </Magnetic>
          </div>
        </section>
      </main>

      <SiteFooter base={base} />
    </>
  );
}
