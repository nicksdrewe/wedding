"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The couple's settings are one place in three parts. This strip sits at the
// top of each part so they read as one settings page.
const TABS = [
  { href: "/wedding", label: "Your wedding" },
  { href: "/access", label: "Roles & access" },
  { href: "/account", label: "My details" },
];

export function SettingsTabs({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className={`flex justify-center ${className}`}>
      <div className="surface inline-flex flex-wrap gap-1 !rounded-full p-1">
        {TABS.map((t) => {
          const on = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={`rounded-full px-4 py-2 font-serif text-[13px] font-semibold transition-colors ${
                on ? "bg-sec text-white" : "text-ink-soft hover:bg-ink/5 hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
