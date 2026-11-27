"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
  { href: "/me", label: "Your weddings", icon: "me" },
];

const THEME_KEY = "pc-theme";

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="pc-clock">--:--:--</span>;
  return (
    <span className="pc-clock" aria-label="Time now">
      {now.toLocaleTimeString("en-GB")}
    </span>
  );
}

/** The console's frame: status bar on top (with the day/night switch), a dock at the bottom. */
export function PlatformShell({ email, children }: { email: string | null; children: React.ReactNode }) {
  const path = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {}
  }, []);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  };

  return (
    <div className="pc" data-pc-theme={theme}>
      <div className="pc-hud" aria-hidden="true" />
      <header className="pc-top">
        <div className="pc-brand">
          <span className="pc-brand-dot" aria-hidden="true" />
          <span>
            Control room
            <small>Weddings Weddings</small>
          </span>
        </div>
        <div className="pc-top-right">
          <span className="pc-status">
            <i aria-hidden="true" /> Live
          </span>
          <Clock />
          <span className="pc-who" title={email ?? undefined}>
            {email}
          </span>
          <button type="button" className={`pc-mode ${theme}`} onClick={flip} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"}>
            <span className="pc-mode-track" aria-hidden="true">
              <svg className="pc-mode-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
              <svg className="pc-mode-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
              <span className="pc-mode-knob" />
            </span>
          </button>
        </div>
      </header>

      <main className="pc-main">{children}</main>

      <nav className="pc-dock" aria-label="Owner console">
        <div className="pc-dock-glass">
          {LINKS.map((l, i) => {
            const on = l.href === "/platform" ? path === l.href : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`pc-dock-item ${on ? "is-on" : ""} ${i === LINKS.length - 1 ? "is-out" : ""}`}
                aria-current={on ? "page" : undefined}
                aria-label={l.label}
              >
                <span className="pc-dock-tip">{l.label}</span>
                <span className="pc-dock-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {ICONS[l.icon]}
                  </svg>
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
