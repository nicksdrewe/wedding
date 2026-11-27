import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";
import { Botanical } from "@/components/Botanical";
import { siteBase } from "@/lib/commercial/base";
import { SITE_NAME, SITE_URL } from "@/lib/commercial/pricing";
import { SiteHeader, SiteFooter } from "./_components/Chrome";
import { FAQ } from "./_components/faq";
import { SystemDemo } from "./_components/SystemDemo";
import { Magnetic, Reveal, Sunlight } from "./_components/Interactive";
import { BoardScene, BudgetScene, DayScene, GuestsScene, MessagesScene, PartyScene, TreeScene } from "./_components/Scenes";

export const dynamic = "force-dynamic";

const CHAPTERS = [
  {
    key: "board",
    colour: "sage",
    kicker: "Planning boards",
    title: "Every decision, side by side.",
    body: "Venues, caterers, the band, the cake. Line the options up with photos, prices, a pin on the map and your notes. Let the people you trust vote and comment, then pick the winner. The others step aside, and the price goes straight into your budget.",
    points: ["Photos, prices and map pins", "Votes and comments from family", "Winners lock into the budget"],
    Scene: BoardScene,
  },
  {
    key: "tree",
    colour: "plum",
    kicker: "The whole picture",
    title: "See the entire wedding on one page.",
    body: "Every decision sits in one tree, from the ceremony to the hen do. Open any branch to see what's decided, what's still up for grabs and what it's costing. When someone asks how it's all going, you can actually show them.",
    points: ["Decided, deciding, not started", "Costs rolled up at every level", "Branches for the stag and hen too"],
    Scene: TreeScene,
  },
  {
    key: "budget",
    colour: "gold",
    kicker: "Budget",
    title: "Know what it costs before your bank does.",
    body: "Rough figures while you're choosing, real ones once you've chosen, and a clear line on who's paying for what. Shared costs for the stag or the hen split themselves, so nobody has to send the awkward message.",
    points: ["Estimates, then actuals", "Who's contributing what", "Group costs split fairly"],
    Scene: BudgetScene,
  },
  {
    key: "guests",
    colour: "rose",
    kicker: "Guests & RSVPs",
    title: "Every guest, every event, every dietary need.",
    body: "Households, plus ones, the engagement party, the ceremony and the evening do. Guests reply from one link without a password, and you see who's coming to what, live. Nobody reconciles three spreadsheets the night before the caterer needs numbers.",
    points: ["RSVPs per event", "Plus ones and dietary needs", "No passwords for guests"],
    Scene: GuestsScene,
  },
  {
    key: "party",
    colour: "plum",
    kicker: "The wedding party",
    title: "Secrets, kept.",
    body: "The best man gets a planning board for the stag that the two of you can't see. The bridesmaids get theirs. Everyone gets exactly the pages you've given them, right down to whether they can see the prices.",
    points: ["Private boards for stag and hen", "Access by role or by person", "Prices shown only where you want"],
    Scene: PartyScene,
  },
  {
    key: "messages",
    colour: "teal",
    kicker: "Messages",
    title: "Send it from your own address. Read the replies here.",
    body: "Save the dates, coach times, the polite nudge to the people who haven't replied. Emails go out from your wedding's own address, to everyone or just the people who need it, and the answers land back in your inbox on the site.",
    points: ["Your names, your address", "Send to exactly the right people", "Replies collected in one inbox"],
    Scene: MessagesScene,
  },
  {
    key: "day",
    colour: "blue",
    kicker: "The day itself",
    title: "On the day, nobody needs to ask.",
    body: "Publish the running order and it's on every phone, with a nudge when something changes. The people helping know where to be, the guests know when to eat, and you get to just be there.",
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
                <span className="ww-pill">Alpha</span> Invite-only, and free while we build it
              </p>
              <h1 className="ww-h1">
                Most wedding websites stop at the RSVP.
                <em>Ours is where the planning happens.</em>
              </h1>
              <p className="ww-lede">
                A private site for your wedding, at your own address, that runs the whole thing: every guest and every reply,
                the venues you&rsquo;re torn between, what it all costs and who&rsquo;s paying, the stag do you&rsquo;re not
                allowed to see, and where everyone needs to be at quarter past three.
              </p>
              <div className="ww-cta-row">
                <Magnetic>
                  <Link href={start} className="ww-btn ww-btn-primary ww-btn-shine">
                    Start your wedding site
                    <span className="ww-arrow" aria-hidden="true">→</span>
                  </Link>
                </Magnetic>
                <a href="#system" className="ww-btn ww-btn-ghost">
                  See how it fits together
                </a>
              </div>
              <p className="ww-fine">You&rsquo;ll need an invite code during the alpha.</p>
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
              <h2 className="ww-h2">The website is the easy bit.</h2>
              <p className="ww-sub">
                The hard bit is the eighteen months before it, scattered across a spreadsheet, three group chats, a mood
                board and someone&rsquo;s notes app. Wedding websites give you a pretty page. Planning apps give you a
                checklist. Neither gives you the place where you, your families and your friends actually decide things
                together.
              </p>
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
              <h2 className="ww-h2">One system, not a pile of features.</h2>
              <p className="ww-sub">
                Choose a venue and the budget knows. Give someone a job and their phone knows. Change the plan and everyone
                knows. Each part below is moving in time with the others, because that&rsquo;s how it works.
              </p>
            </Reveal>

            <div className="ww-chapters">
              {CHAPTERS.map((c, i) => (
                <Reveal key={c.key} className={`ww-chapter ${i % 2 ? "flip" : ""}`}>
                  <div className={`ww-chapter-art tone-${c.colour}`}>
                    <c.Scene />
                  </div>
                  <div className={`ww-chapter-copy tone-${c.colour}`}>
                    <p className="ww-chapter-kicker">{c.kicker}</p>
                    <h3>{c.title}</h3>
                    <p>{c.body}</p>
                    <ul>
                      {c.points.map((p) => (
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
              <h2 className="ww-h2">The small things you&rsquo;d otherwise build yourself.</h2>
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
              <h2 className="ww-h2">Everyone gets the right amount of wedding.</h2>
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
              <h2 className="ww-h2">Set up in an evening. Useful until the last dance.</h2>
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
              <h2 className="ww-h2">We&rsquo;re building this with a small group of couples.</h2>
              <p className="ww-sub">
                It started as the site for one real wedding and grew from there. Right now it&rsquo;s invite-only and
                free. If you&rsquo;ve been sent a code, you&rsquo;re in.
              </p>
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
            <h2 className="ww-h2">You&rsquo;ve got a wedding to plan. Give it somewhere to live.</h2>
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
