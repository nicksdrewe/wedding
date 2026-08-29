import Link from "next/link";
import type { RoleTier } from "@/lib/auth/roles";

const LINKS: { href: string; label: string; roles: RoleTier[] }[] = [
  { href: "/categories", label: "Categories", roles: ["couple", "family"] },
  { href: "/diary", label: "Diary", roles: ["couple", "family"] },
  { href: "/project", label: "Project Management", roles: ["couple", "wedding_party"] },
  { href: "/budget", label: "Budget", roles: ["couple"] },
  { href: "/guests", label: "Guest List", roles: ["couple"] },
];

export function SiteNav({ role }: { role: RoleTier }) {
  const links = LINKS.filter((l) => l.roles.includes(role));

  return (
    <nav className="flex flex-wrap items-center gap-6 border-b border-ink/10 bg-cream-deep/50 px-6 py-4 font-serif text-sm md:px-12">
      <Link href="/" className="font-script text-lg">
        N &amp; E
      </Link>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="text-ink-soft hover:text-ink">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
