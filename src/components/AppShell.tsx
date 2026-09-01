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
  Sparkles,
  User,
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
// guards: both read the same role (and, since the account-capabilities
// rollout, the same contact tags) as the pages themselves.
//
// This is a convenience mirror of the real access model
// (src/lib/permissions/actions.ts's getEffectivePermission, backed by
// page_permissions/RLS) for nav-link VISIBILITY only — AppShell is a
// client component and can't call the server-only resolver, so it
// re-derives roughly the same role/tag logic here. It is NOT the
// enforcement layer: a link not showing here doesn't block the route, and
// a link showing here doesn't grant access either — every page still does
// its own getEffectivePermission/RLS check regardless of what nav renders.
// Keep this table in sync with the seeded page_permissions rows
// (0027/0028 migrations) rather than trusting it as a source of truth.

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: RoleTier[];
  // Contact tags that also unlock this link regardless of role — e.g.
  // best_man/maid_of_honour seeing the broad planning links even though
  // plain wedding_party no longer does.
  tags?: string[];
  // Roles that can see this link but only in a read-only capacity — the
  // spec's "Guests (read-only badge)" note for family.
  viewOnlyRoles?: RoleTier[];
};

const NAV_LINKS: NavLink[] = [
  {
    href: "/categories",
    label: "Categories",
    icon: LayoutGrid,
    roles: ["couple", "family"],
    tags: ["best_man", "maid_of_honour"],
  },
  {
    href: "/guests",
    label: "Guests",
    icon: Users,
    roles: ["couple", "family"],
    tags: ["best_man", "maid_of_honour"],
    viewOnlyRoles: ["family"],
  },
  {
    href: "/project",
    label: "Project",
    icon: FolderKanban,
    roles: ["couple", "family"],
    tags: ["best_man", "maid_of_honour"],
  },
  {
    href: "/budget",
    label: "Budget",
    icon: Wallet,
    roles: ["couple", "family"],
    tags: ["best_man", "maid_of_honour"],
  },
  { href: "/comms", label: "Comms", icon: Mail, roles: ["couple"] },
  // The dedicated "Engagement Party" link this used to carry is gone now
  // that the events system exists — /diary is the way back to any
  // event's own page (and, for the couple, its edit form) instead of one
  // hardcoded nav item per event. Every role reaches Diary — it's the one
  // page every account tier (down to a plain guest) gets, per the
  // account-capabilities brief.
  { href: "/diary", label: "Diary", icon: BookOpen, roles: ["couple", "family", "wedding_party", "guest"] },
  // "Edit my page" — the guest/wedding_party self-service surface. Couple
  // and family don't need this in nav (they're not personally RSVPing).
  { href: "/account", label: "My Details", icon: User, roles: ["guest", "wedding_party"] },
  // Gendered wedding-party boards — only their own tag (plus the elevated
  // best_man/maid_of_honour cross-grant) sees each one; the couple sees
  // both.
  {
    href: "/project/bridesmaids",
    label: "Bridesmaids",
    icon: Sparkles,
    roles: ["couple"],
    tags: ["bridesmaid", "maid_of_honour"],
  },
  {
    href: "/project/groomsmen",
    label: "Groomsmen",
    icon: PartyPopper,
    roles: ["couple"],
    tags: ["groomsman", "best_man"],
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
  /** The signed-in user's own contact tags (best_man, bridesmaid, etc.) —
   *  from getCurrentContactTags(profile) (src/lib/auth/roles.ts). Optional
   *  because most callers that only need role-gated links can omit it;
   *  defaults to none. */
  tags?: string[];
  children: React.ReactNode;
};

export function AppShell({ profile, tags = [], children }: AppShellProps) {
  const pathname = usePathname();
  const links = NAV_LINKS.filter(
    (link) => canAccess(profile.role, link.roles) || link.tags?.some((t) => tags.includes(t))
  );
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
            {profile.role === "couple" ? (
              <Link
                href="/access"
                title="Manage roles & access"
                className="rounded-full bg-cream-deep px-2 py-0.5 text-[10px] tracking-[0.08em] text-ink-soft uppercase transition-colors hover:text-accent"
              >
                {ROLE_LABEL[profile.role]}
              </Link>
            ) : (
              <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[10px] tracking-[0.08em] text-ink-soft uppercase">
                {ROLE_LABEL[profile.role]}
              </span>
            )}
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
