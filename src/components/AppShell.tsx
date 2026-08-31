"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FolderKanban,
  LayoutGrid,
  LogOut,
  Mail,
  PartyPopper,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Botanical } from "@/components/Botanical";
import { AnimatedBackground } from "@/components/motion-primitives/animated-background";
import { canAccess, type Profile, type RoleTier } from "@/lib/auth/role-types";

// App Shell Design Spec §1 — the shared top nav (+ mobile bottom tab bar)
// for every signed-in page. One instance of this, mounted by each route
// group's layout.tsx with the server-resolved profile, is what keeps
// nav-link visibility from ever drifting out of sync with the real route
// guards: both read the same role, and link visibility here is driven by
// the same canAccess() helper the layouts use to gate the routes.
//
// NOTE for the agents wiring this up: the `roles` below encode the design
// brief's stated visibility table (couple -> all five; family/wedding_party
// -> Categories, Guests [view-only], Diary; guest -> nothing). That table
// is broader in a couple of places than the *current* redirects in
// (family)/(admin)/(party)/layout.tsx (e.g. /guests today redirects
// non-couple roles to /no-access, and /project admits wedding_party but
// isn't in family/wedding_party's list here). Reconcile those guards
// against this table when wiring pages, or trim this table to match the
// guards — don't let the two silently diverge.

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: RoleTier[];
  // Roles that can see this link but only in a read-only capacity — the
  // spec's "Guests (read-only badge)" note for family/wedding_party.
  viewOnlyRoles?: RoleTier[];
};

const NAV_LINKS: NavLink[] = [
  { href: "/categories", label: "Categories", icon: LayoutGrid, roles: ["couple", "family", "wedding_party"] },
  {
    href: "/guests",
    label: "Guests",
    icon: Users,
    roles: ["couple", "family", "wedding_party"],
    viewOnlyRoles: ["family", "wedding_party"],
  },
  { href: "/project", label: "Project", icon: FolderKanban, roles: ["couple"] },
  { href: "/budget", label: "Budget", icon: Wallet, roles: ["couple"] },
  { href: "/comms", label: "Comms", icon: Mail, roles: ["couple"] },
  { href: "/diary", label: "Diary", icon: BookOpen, roles: ["couple", "family", "wedding_party"] },
  // Leaves the app shell for the public /engagement page (it isn't part of
  // this route-group system) — same idea as the wordmark's "back to
  // landing" link. Needed because there was previously no path back to it
  // at all once signed in: the couple's only way to manage its photos was
  // manually typing the URL, since edit controls there are gated on being
  // signed in as the couple but the page itself has no link pointing to it.
  {
    href: "/engagement",
    label: "Engagement Party",
    icon: PartyPopper,
    roles: ["couple", "family", "wedding_party"],
  },
];

const ROLE_LABEL: Record<RoleTier, string> = {
  couple: "Couple",
  family: "Family",
  wedding_party: "Wedding Party",
  guest: "Guest",
};

function isActiveHref(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function firstName(fullName: string | null) {
  if (!fullName) return null;
  return fullName.trim().split(/\s+/)[0] ?? null;
}

export type AppShellProps = {
  /** The signed-in user's resolved profile — role drives nav visibility,
   *  full_name drives the greeting. Pages get this from getCurrentProfile()
   *  / getAuthState() (src/lib/auth/roles.ts), which they already need for
   *  their own route guard. */
  profile: Profile;
  children: React.ReactNode;
};

export function AppShell({ profile, children }: AppShellProps) {
  const pathname = usePathname();
  const links = NAV_LINKS.filter((link) => canAccess(profile.role, link.roles));
  const name = firstName(profile.full_name);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 h-16 border-b border-ink/10 bg-[#f4f1ec]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          {/* Left: wordmark — this IS the "back to landing" affordance. */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Botanical
              seed={7}
              stems={1}
              width={20}
              height={22}
              spread={7}
              strokeOpacity={0.75}
              fillOpacity={0.4}
              className="shrink-0"
            />
            <span className="font-display text-[15px] tracking-tight">Nick &amp; Ellie</span>
          </Link>

          {/* Center-left: role-filtered nav, hidden below md in favour of
              the bottom tab bar. */}
          <nav className="hidden items-center gap-1 md:flex">
            <AnimatedBackground
              className="rounded-full bg-accent/10"
              transition={{ duration: 0.15 }}
              enableHover
            >
              {links.map((link) => {
                const active = isActiveHref(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    data-id={link.href}
                    href={link.href}
                    className={`rounded-full px-3 py-2 font-serif text-[13px] font-medium tracking-[0.02em] transition-colors duration-150 ${
                      active ? "text-accent" : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {link.label}
                    {link.viewOnlyRoles?.includes(profile.role) && (
                      <span className="ml-1.5 rounded-full bg-cream-deep px-1.5 py-0.5 text-[8px] font-medium tracking-[0.06em] text-ink-soft/70 uppercase">
                        View
                      </span>
                    )}
                  </Link>
                );
              })}
            </AnimatedBackground>
          </nav>

          {/* Right: identity + sign out. */}
          <div className="flex shrink-0 items-center gap-3">
            {name && <span className="hidden text-[13px] text-ink-soft sm:inline">{name}</span>}
            <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[10px] tracking-[0.08em] text-ink-soft uppercase">
              {ROLE_LABEL[profile.role]}
            </span>
            <a
              href="/logout"
              aria-label="Sign out"
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors duration-150 hover:bg-ink/5 hover:text-ink"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
            </a>
          </div>
        </div>
      </header>

      {/* pb-24 clears the fixed mobile tab bar; md:pb-10 restores normal
          bottom spacing once that bar is hidden. */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 pb-24 md:px-12 md:pb-10">
        {children}
      </main>

      {/* Mobile: bottom tab bar instead of a hamburger — this is a tool
          people open one-handed at a venue. Only rendered when there's
          something to show (a "guest" role resolves to zero links, and the
          bar simply omits itself). */}
      {links.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink/10 bg-[#f4f1ec] md:hidden">
          {links.map((link) => {
            const active = isActiveHref(pathname, link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium tracking-[0.02em] transition-colors duration-150 ${
                  active ? "text-accent" : "text-ink-soft"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
