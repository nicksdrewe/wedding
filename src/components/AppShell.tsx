"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  FolderKanban,
  LayoutGrid,
  LogOut,
  Menu,
  X,
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
import useClickOutside from "@/hooks/useClickOutside";

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
  // Desktop-only grouping into a dropdown menu (e.g. "Planning", "People")
  // — the mobile bottom tab bar always renders every visible link flat,
  // regardless of this field, since a nested menu doesn't fit that space.
  group?: string;
};

const NAV_LINKS: NavLink[] = [
  {
    href: "/categories",
    label: "Categories",
    icon: LayoutGrid,
    roles: ["couple", "family"],
    tags: ["best_man", "maid_of_honour"],
    group: "Planning",
  },
  {
    href: "/project",
    label: "Project",
    icon: FolderKanban,
    roles: ["couple", "family"],
    tags: ["best_man", "maid_of_honour"],
    group: "Planning",
  },
  // Gendered wedding-party boards — only their own tag (plus the elevated
  // best_man/maid_of_honour cross-grant) sees each one; the couple sees
  // both.
  {
    href: "/project/bridesmaids",
    label: "Bridesmaids",
    icon: Sparkles,
    roles: ["couple"],
    tags: ["bridesmaid", "maid_of_honour"],
    group: "Planning",
  },
  {
    href: "/project/groomsmen",
    label: "Groomsmen",
    icon: PartyPopper,
    roles: ["couple"],
    tags: ["groomsman", "best_man"],
    group: "Planning",
  },
  {
    href: "/guests",
    label: "Guests",
    icon: Users,
    roles: ["couple", "family"],
    viewOnlyRoles: ["family"],
    group: "People",
  },
  { href: "/comms", label: "Comms", icon: Mail, roles: ["couple"], group: "People" },
  {
    href: "/budget",
    label: "Budget",
    icon: Wallet,
    roles: ["couple", "family"],
  },
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
];

// Desktop nav order: grouped dropdowns first (Planning, then People, each
// in NAV_LINKS' own order), then every ungrouped link in NAV_LINKS order.
const GROUP_ORDER = ["Planning", "People"];

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

// Groups the already role/tag-filtered links into desktop nav items: a
// dropdown per group (only for groups with at least one visible link,
// GROUP_ORDER first, any others alphabetically after), then every
// ungrouped link in its original NAV_LINKS order.
function buildDesktopItems(links: NavLink[]) {
  const byGroup = new Map<string, NavLink[]>();
  const ungrouped: NavLink[] = [];
  for (const link of links) {
    if (link.group) {
      const list = byGroup.get(link.group) ?? [];
      list.push(link);
      byGroup.set(link.group, list);
    } else {
      ungrouped.push(link);
    }
  }
  const groupNames = [
    ...GROUP_ORDER.filter((g) => byGroup.has(g)),
    ...[...byGroup.keys()].filter((g) => !GROUP_ORDER.includes(g)),
  ];
  return {
    groups: groupNames.map((name) => ({ name, links: byGroup.get(name)! })),
    ungrouped,
  };
}

// A dropdown nav item — trigger styled like a plain nav pill, opens a
// small menu of the group's links below it. Plain local open/close state
// + useClickOutside (same hook MorphingPopover uses) rather than that
// component itself: this needs a simple anchored panel, not a shared-
// layoutId morph animation.
function NavGroupDropdown({
  name,
  links,
  pathname,
}: {
  name: string;
  links: NavLink[];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const active = links.some((l) => isActiveHref(pathname, l.href));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-id={name}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex items-center gap-1 rounded-full px-3 py-2 font-serif text-[13px] font-medium tracking-[0.02em] transition-colors duration-150 ${
          active ? "text-accent" : "text-ink-soft hover:text-ink"
        }`}
      >
        {name}
        <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`} strokeWidth={2.5} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1.5 min-w-[160px] rounded-[10px] border border-ink/10 bg-cream p-1.5 shadow-lg">
          {links.map((link) => {
            const linkActive = isActiveHref(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`block rounded-[8px] px-3 py-2 font-serif text-[13px] font-medium tracking-[0.02em] transition-colors duration-150 ${
                  linkActive ? "bg-accent/10 text-accent" : "text-ink-soft hover:bg-cream-deep hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
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
  const { groups, ungrouped } = buildDesktopItems(links);
  const name = firstName(profile.full_name);

  // Phone menu: one burger button instead of a bar holding every link. Closes
  // whenever the page changes, and locks the page behind it from scrolling.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

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
            {/* Grouped dropdowns (Planning, People) render outside
                AnimatedBackground — it clones each direct child and
                overwrites its own children with the hover-highlight
                wrapper, which only works for a plain label like a Link's
                text, not a component that renders its own conditional
                dropdown panel. */}
            {groups.map((group) => (
              <NavGroupDropdown key={group.name} name={group.name} links={group.links} pathname={pathname} />
            ))}
            <AnimatedBackground
              className="rounded-full bg-accent/10"
              transition={{ duration: 0.15 }}
              enableHover
            >
              {ungrouped.map((link) => {
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
            {links.length > 0 && (
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5 md:hidden"
              >
                {menuOpen ? <X className="h-5 w-5" strokeWidth={2} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
              </button>
            )}
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 md:px-12">
        {children}
      </main>

      {/* Phone menu panel, opened by the burger in the header. Same grouping
          as the desktop dropdowns (Planning, People, then the rest). Links
          are full-width, 48px tall, for thumbs. */}
      {links.length > 0 && menuOpen && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-30 overflow-y-auto bg-[#f4f1ec] px-6 py-6 md:hidden">
          <nav aria-label="Main menu" className="mx-auto flex max-w-md flex-col gap-6">
            {[...groups.map((g) => ({ name: g.name, links: g.links })), ...(ungrouped.length ? [{ name: "", links: ungrouped }] : [])].map(
              (section) => (
                <div key={section.name || "other"}>
                  {section.name && (
                    <p className="mb-1 px-3 font-serif text-[11px] font-semibold tracking-[0.18em] text-ink-soft/70 uppercase">
                      {section.name}
                    </p>
                  )}
                  <ul className="flex flex-col">
                    {section.links.map((link) => {
                      const active = isActiveHref(pathname, link.href);
                      const Icon = link.icon;
                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className={`flex min-h-12 items-center gap-3 rounded-[12px] px-3 font-serif text-[15px] transition-colors ${
                              active ? "bg-accent/10 text-accent" : "text-ink hover:bg-ink/5"
                            }`}
                          >
                            <Icon className="h-5 w-5 shrink-0" strokeWidth={2} />
                            {link.label}
                            {link.viewOnlyRoles?.includes(profile.role) && (
                              <span className="rounded-full bg-cream-deep px-1.5 py-0.5 text-[8px] font-medium tracking-[0.06em] text-ink-soft/70 uppercase">
                                View
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )
            )}
            <div className="flex items-center justify-between border-t border-ink/10 px-3 pt-4 font-serif text-sm text-ink-soft">
              <span>
                {name ? `${name} · ` : ""}
                {ROLE_LABEL[profile.role]}
              </span>
              <a href="/logout" className="inline-flex min-h-10 items-center gap-2 text-ink">
                <LogOut className="h-4 w-4" strokeWidth={2} />
                Sign out
              </a>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
