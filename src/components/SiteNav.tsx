"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RoleTier } from "@/lib/auth/roles";

const ALL_ROLES: RoleTier[] = ["couple", "family", "wedding_party", "guest"];

const LINKS: { href: string; label: string; roles: RoleTier[] }[] = [
  { href: "/categories", label: "Categories", roles: ["couple", "family"] },
  { href: "/diary", label: "Diary", roles: ["couple", "family"] },
  { href: "/project", label: "Project Management", roles: ["couple", "wedding_party"] },
  { href: "/budget", label: "Budget", roles: ["couple"] },
  { href: "/guests", label: "Guest List", roles: ["couple"] },
  { href: "/account", label: "Account", roles: ALL_ROLES },
];

export function SiteNav({ role }: { role: RoleTier }) {
  const pathname = usePathname();
  const links = LINKS.filter((l) => l.roles.includes(role));

  return (
    <nav className="flex flex-wrap items-center gap-7 border-b border-ink/8 bg-cream-deep px-6 py-4 md:px-12">
      <Link href="/" className="font-serif text-sm font-bold">
        N&amp;E
      </Link>
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`-mb-px border-b-2 pb-1 font-serif text-[12px] tracking-[0.06em] uppercase transition ${
              active
                ? "border-accent text-ink"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
