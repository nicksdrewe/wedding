import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";
import { SITE_NAME } from "@/lib/commercial/pricing";

export function SiteHeader({ base, minimal = false }: { base: string; minimal?: boolean }) {
  const home = base || "/";
  const at = (id: string) => `${base || "/"}#${id}`;
  return (
    <header className="ww-header">
      <div className="ww-wrap ww-header-inner">
        <Link href={home} className="ww-brand" aria-label={`${SITE_NAME} home`}>
          <LogoMark size={34} />
          <span>{SITE_NAME}</span>
        </Link>
        {!minimal && (
          <nav className="ww-nav" aria-label="Main">
            <a href={at("inside")}>Inside</a>
            <a href={at("alpha")}>Alpha</a>
            <a href={at("faq")}>Questions</a>
            <Link href={`${base}/signin`}>Sign in</Link>
            <Link href={`${base}/start`} className="ww-btn ww-btn-primary ww-btn-sm">
              Start
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}

export function SiteFooter({ base }: { base: string }) {
  return (
    <footer className="ww-footer">
      <div className="ww-wrap ww-footer-inner">
        <div className="ww-brand">
          <LogoMark size={28} />
          <span>{SITE_NAME}</span>
        </div>
        <div>
          <p>Private wedding websites, made in the UK.</p>
          <nav className="ww-smallprint" aria-label="Legal" style={{ marginTop: 6 }}>
            <Link href={`${base}/privacy`}>Privacy</Link>
            <Link href={`${base}/terms`}>Terms</Link>
            <Link href={`${base}/cookies`}>Cookies</Link>
          </nav>
        </div>
        <nav aria-label="Footer">
          <Link href={`${base}/start`}>Start your site</Link>
          <Link href={`${base}/signin`}>Sign in</Link>
        </nav>
      </div>
    </footer>
  );
}
