"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  overview: <path d="M3 13h4v8H3zM10 8h4v13h-4zM17 3h4v18h-4z" />,
  weddings: <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" />,
  newsletters: <path d="M3 6h18v12H3zM3 7l9 6 9-6" />,
  marketing: <path d="M3 11v2l13 5V6zM16 9a3 3 0 0 1 0 6M6 13l1 6h3l-1-5" />,
  copy: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  me: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
};

const LINKS = [
  { href: "/platform", label: "Overview", icon: "overview" },
  { href: "/platform/weddings", label: "Weddings", icon: "weddings" },
  { href: "/platform/newsletters", label: "Newsletters", icon: "newsletters" },
  { href: "/platform/marketing", label: "Marketing", icon: "marketing" },
  { href: "/platform/copy", label: "Site words", icon: "copy" },
];

export function PlatformNav({ email }: { email: string | null }) {
  const path = usePathname();
  return (
    <nav className="pc-nav" aria-label="Owner console">
      <div className="pc-brand">
        <span className="pc-brand-dot" aria-hidden="true" />
        <span>
          Control room
          <small>Weddings Weddings</small>
        </span>
      </div>
      {LINKS.map((l) => {
        const on = l.href === "/platform" ? path === l.href : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`pc-nav-link ${on ? "is-on" : ""}`} aria-current={on ? "page" : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {ICONS[l.icon]}
            </svg>
            {l.label}
          </Link>
        );
      })}
      <Link href="/me" className="pc-nav-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {ICONS.me}
        </svg>
        Your weddings
      </Link>
      <div className="pc-nav-foot">
        <span>Signed in as</span>
        <span style={{ color: "#8b94a7", overflowWrap: "anywhere" }}>{email}</span>
      </div>
    </nav>
  );
}
