import Link from "next/link";
import { siteBase } from "@/lib/commercial/base";
import { LEGAL } from "@/lib/commercial/legal";
import { SiteFooter, SiteHeader } from "./Chrome";

// Shared frame for the privacy, terms and cookie pages: plain, readable, with
// links between them.
export async function LegalPage({
  kicker,
  title,
  intro,
  children,
}: {
  kicker: string;
  title: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  const base = await siteBase();
  return (
    <>
      <SiteHeader base={base} />
      <main className="ww-legal">
        <div className="ww-wrap ww-narrow">
          <p className="ww-kicker">{kicker}</p>
          <h1 className="ww-h2">{title}</h1>
          <p className="ww-legal-meta">Last updated {LEGAL.updated}</p>
          <div className="ww-legal-intro">{intro}</div>
          <nav className="ww-legal-nav" aria-label="Legal pages">
            <Link href={`${base}/privacy`}>Privacy</Link>
            <Link href={`${base}/terms`}>Terms</Link>
            <Link href={`${base}/cookies`}>Cookies</Link>
          </nav>
          <div className="ww-legal-body">{children}</div>
          <p className="ww-legal-contact">
            Questions about any of this? Email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
          </p>
        </div>
      </main>
      <SiteFooter base={base} />
    </>
  );
}
