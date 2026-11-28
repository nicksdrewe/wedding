"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CalendarHeart,
  ClipboardList,
  ChevronDown,
  FolderKanban,
  KeyRound,
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
  Settings,
} from "lucide-react";
import { Botanical } from "@/components/Botanical";
import { LogoMark } from "@/components/LogoMark";
import { AnimatedBackground } from "@/components/motion-primitives/animated-background";
import { canAccess, type Profile, type RoleTier } from "@/lib/auth/role-types";
import useClickOutside from "@/hooks/useClickOutside";
import { Backdrop } from "@/components/ui/Backdrop";
import { sectionFor } from "@/lib/design/sections";
import { useWedding } from "@/components/WeddingProvider";
import { ExamplesBarOption, ExamplesToggle, HeaderExamplesToggle } from "@/components/ExamplesToggle";
import { ROOT_DOMAIN } from "@/lib/wedding/host";

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
    href: "/project",
    label: "Wedding Planning",
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
  { href: "/comms", label: "Guest Comms", icon: Mail, roles: ["couple"], group: "Comms" },
  // The organising log (0043): couple, family, best man and maid of honour.
  {
    href: "/organising",
    label: "Organising",
    icon: ClipboardList,
    roles: ["couple", "family"],
    tags: ["best_man", "maid_of_honour"],
    group: "Comms",
  },
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
  // The schedule for the wedding days themselves (0044). Guests get it once it is published.
  { href: "/big-day", label: "The Big Day", icon: CalendarHeart, roles: ["couple", "family", "wedding_party"] },
  // "Edit my page" — the guest/wedding_party self-service surface. Couple
  // and family don't need this in nav (they're not personally RSVPing).
];

// Behind the role chip (top right) rather than in the main menu: your own
// details, and for the couple the wedding's settings.
const SETTINGS_LINKS: { href: string; label: string; hint: string; icon: LucideIcon; couple?: boolean }[] = [
  { href: "/wedding", label: "Your wedding", hint: "Names, date, colours, access code", icon: Settings, couple: true },
  { href: "/access", label: "Roles & access", hint: "Who can see and change each page", icon: KeyRound, couple: true },
  { href: "/account", label: "My details", hint: "Your name, photo and sign-in", icon: User },
];

// Desktop nav order: grouped dropdowns first (Planning, then People, each
// in NAV_LINKS' own order), then every ungrouped link in NAV_LINKS order.
const GROUP_ORDER = ["Planning", "People", "Comms"];

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
          active ? "text-sec" : "text-ink-soft hover:text-ink"
        }`}
      >
        {name}
        <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`} strokeWidth={2.5} />
      </button>
      {open && (
        <div className="surface surface-raised rise absolute top-full left-0 z-50 mt-2.5 min-w-[180px] !rounded-[16px] p-1.5">
          {links.map((link) => {
            const linkActive = isActiveHref(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`block rounded-[11px] px-3 py-2.5 font-serif text-[13px] font-medium tracking-[0.02em] transition-colors duration-150 ${
                  linkActive ? "bg-sec-tint text-sec" : "text-ink-soft hover:bg-ink/5 hover:text-ink"
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
  const wedding = useWedding();
  const pathname = usePathname();
  const links = NAV_LINKS.filter(
    (link) => canAccess(profile.role, link.roles) || link.tags?.some((t) => tags.includes(t))
  );
  const { groups, ungrouped } = buildDesktopItems(links);
  const name = firstName(profile.full_name);

  // Phone menu: one burger button instead of a bar holding every link. Closes
  // whenever the page changes, and locks the page behind it from scrolling.
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(false);
    setSettingsOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSettingsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);
  const isCouple = profile.role === "couple";
  const settingsLinks = SETTINGS_LINKS.filter((l) => !l.couple || isCouple);
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  // A few seconds after arriving, quietly load the pages you're most likely to
  // open next (one every second or so), so the first click on them is instant.
  const [warmCount, setWarmCount] = useState(0);
  useEffect(() => {
    setWarmCount(0);
    let n = 0;
    const start = setTimeout(function tick() {
      n += 1;
      setWarmCount(n);
      if (n < 6) setTimeout(tick, 900);
    }, 2500);
    return () => clearTimeout(start);
  }, [pathname]);
  const warmLinks = links.filter((l) => !isActiveHref(pathname, l.href) && l.href !== "/logout").slice(0, warmCount);

  const section = sectionFor(pathname);
  const rawSections = [
    ...groups.map((g) => ({ name: g.name, links: g.links })),
    ...(ungrouped.length ? [{ name: "", links: ungrouped }] : []),
  ];
  // Each section remembers how many links came before it, for the stagger.
  const sections = rawSections.map((s, idx) => ({
    ...s,
    start: rawSections.slice(0, idx).reduce((n, x) => n + x.links.length, 0),
  }));

  return (
    <div data-shell data-section={section} className="relative flex min-h-screen flex-col">
      <Backdrop />
      {warmLinks.map((l) => (
        <Link key={l.href} href={l.href} prefetch tabIndex={-1} aria-hidden="true" className="pointer-events-none absolute top-0 left-0 h-px w-px overflow-hidden opacity-0" />
      ))}

      {/* A floating glass bar rather than a strip glued to the top: the page's
          light shows through it and it casts its own shadow, which is the
          first cue that things here sit in layers. */}
      <header className="sticky top-0 z-40 touch-pan-y overflow-x-clip px-3 pt-3">
        <div className="surface surface-glass surface-raised mx-auto flex h-14 max-w-[1760px] items-center justify-between !rounded-full px-4 sm:px-5">
          {/* Left: wordmark — this IS the "back to landing" affordance. */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <LogoMark size={34} className="shrink-0" />
            <span className="font-title text-[17px] tracking-tight">{wedding.displayName}</span>
          </Link>

          {/* Centre: role-filtered nav, hidden below md in favour of the
              burger menu. */}
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
            <AnimatedBackground className="rounded-full bg-sec-tint" transition={{ duration: 0.15 }} enableHover>
              {ungrouped.map((link) => {
                const active = isActiveHref(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    data-id={link.href}
                    href={link.href}
                    className={`rounded-full px-3 py-2 font-serif text-[13px] font-medium tracking-[0.02em] transition-colors duration-150 ${
                      active ? "text-sec" : "text-ink-soft hover:text-ink"
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
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {isCouple && <HeaderExamplesToggle />}
            {name && <span className="hidden text-[13px] text-ink-soft lg:inline">{name}</span>}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={settingsOpen}
              title={isCouple ? "Settings" : "My details"}
              className="chip chip-sec inline-flex items-center gap-1.5 !text-[10px] tracking-[0.08em] uppercase transition-opacity hover:opacity-80"
            >
              <Settings className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
              {ROLE_LABEL[profile.role]}
            </button>
            <a
              href="/logout"
              aria-label="Sign out"
              title="Sign out"
              className="hidden h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors duration-150 hover:bg-ink/5 hover:text-ink md:flex"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
            </a>
            {links.length > 0 && (
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                className="flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5 md:hidden"
              >
                {menuOpen ? <X className="h-5 w-5" strokeWidth={2} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
              </button>
            )}
          </div>
        </div>
      </header>

      {wedding.showExamples && (
        <div className="relative z-10 mx-auto mt-3 flex w-full max-w-[1760px] justify-center px-4">
          <p className="chip chip-sec !px-4 !py-1.5 text-center !text-[12px]">
            You&rsquo;re looking at example plans.{" "}
            {isCouple ? "Roll the ball back (top right) to clear them." : "The couple can clear them."}
          </p>
        </div>
      )}

      <main className="relative z-10 mx-auto w-full max-w-[1760px] flex-1 px-4 pt-6 pb-16 sm:px-6 md:px-10 2xl:px-14">
        {children}
      </main>

      {/* Phone menu, opened by the burger. It's the night garden: the same
          dark green as the landing page, with the links falling into place.
          Same grouping as the desktop dropdowns; every link is 52px tall. */}
      {links.length > 0 && menuOpen && (
        <div className="fixed inset-0 z-30 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain bg-gradient-to-b from-forest to-night px-5 pt-24 pb-10 text-cream md:hidden">
          <div aria-hidden="true" className="pointer-events-none absolute right-[-20px] bottom-[-24px] origin-bottom" style={{ animation: "sway 10s ease-in-out infinite" }}>
            <Botanical seed={17} stems={3} width={200} height={330} spread={34} color="var(--sec-glow)" strokeOpacity={0.28} fillOpacity={0.12} />
          </div>
          <nav aria-label="Main menu" className="relative mx-auto flex max-w-md flex-col gap-6">
            {sections.map((group) => (
              <div key={group.name || "other"}>
                {group.name && (
                  <p className="mb-1 px-3 font-serif text-[11px] font-semibold tracking-[0.2em] text-cream/50 uppercase">{group.name}</p>
                )}
                <ul className="flex flex-col">
                  {group.links.map((link, li) => {
                    const active = isActiveHref(pathname, link.href);
                    const Icon = link.icon;
                    const i = group.start + li;
                    return (
                      <li key={link.href} style={{ animation: `menuIn 420ms var(--ease-out) ${i * 35}ms both` }}>
                        <Link
                          href={link.href}
                          className={`flex min-h-[52px] items-center gap-3.5 rounded-[14px] px-3 font-title text-[21px] transition-colors ${
                            active ? "bg-cream/10 text-white" : "text-cream/85 hover:bg-cream/5"
                          }`}
                        >
                          <Icon className={`h-5 w-5 shrink-0 ${active ? "text-sec-glow" : "text-cream/50"}`} strokeWidth={1.75} />
                          {link.label}
                          {link.viewOnlyRoles?.includes(profile.role) && (
                            <span className="rounded-full bg-cream/10 px-2 py-0.5 font-serif text-[9px] font-medium tracking-[0.08em] text-cream/70 uppercase">
                              View
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cream/15 px-3 pt-4 font-serif text-sm text-cream/60">
              <span>
                {name ? `${name} · ` : ""}
                {ROLE_LABEL[profile.role]}
              </span>
              <span className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="inline-flex min-h-11 items-center gap-2 text-cream"
                >
                  <Settings className="h-4 w-4" strokeWidth={2} />
                  {isCouple ? "Settings" : "My details"}
                </button>
                <a href="/logout" className="inline-flex min-h-11 items-center gap-2 text-cream">
                  <LogOut className="h-4 w-4" strokeWidth={2} />
                  Sign out
                </a>
              </span>
            </div>
          </nav>
        </div>
      )}

      {/* Settings, slid in from the side by the role chip. */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Settings">
          <button
            type="button"
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
            className="absolute inset-0 bg-night/30 backdrop-blur-[2px]"
            style={{ animation: "fadeIn 240ms ease both" }}
          />
          <aside
            className="surface surface-raised absolute top-3 right-3 bottom-3 flex w-[min(380px,calc(100vw-24px))] flex-col overflow-y-auto !rounded-[24px] p-5"
            style={{ animation: "drawerIn 380ms var(--ease-out) both" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Settings</p>
                <p className="mt-1 font-title text-[24px] leading-tight">{name ?? "You"}</p>
                <p className="mt-0.5 font-serif text-[13px] text-ink-soft">
                  {ROLE_LABEL[profile.role]} · {wedding.displayName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <nav className="mt-6 flex flex-col gap-1.5" aria-label="Settings pages">
              {settingsLinks.map((l) => {
                const Icon = l.icon;
                const active = isActiveHref(pathname, l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`flex items-center gap-3.5 rounded-[16px] px-3.5 py-3 transition-colors ${
                      active ? "bg-sec-tint" : "hover:bg-ink/5"
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sec-tint text-sec">
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-serif text-[15px] font-semibold text-ink">{l.label}</span>
                      <span className="block font-serif text-[12.5px] text-ink-soft">{l.hint}</span>
                    </span>
                  </Link>
                );
              })}
            </nav>

            {isCouple && (
              <div className="mt-6 rounded-[18px] border border-ink/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-serif text-[15px] font-semibold">Example plans</p>
                  <ExamplesToggle />
                </div>
                <p className="mt-1.5 font-reading text-[13.5px] leading-snug text-ink-soft">
                  Fill every planning page with a made-up wedding to see how it all works. Switch it off and it all
                  disappears; your own plans are never touched.
                </p>
                <ExamplesBarOption />
              </div>
            )}

            <a
              href="/me"
              className="group mt-4 flex items-center justify-between gap-3 rounded-[18px] border border-ink/10 p-4 transition-colors hover:bg-ink/5"
            >
              <span>
                <span className="block font-serif text-[15px] font-semibold">Your weddings</span>
                <span className="block font-reading text-[13.5px] leading-snug text-ink-soft">
                  Every wedding you&rsquo;re part of, your RSVPs and what&rsquo;s coming up.
                </span>
              </span>
              <span aria-hidden="true" className="text-[18px] transition-transform group-hover:translate-x-1">
                →
              </span>
            </a>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-6">
              <a
                href="/logout"
                className="flex items-center gap-2 rounded-full px-3 py-2.5 font-serif text-[14px] text-ink-soft hover:bg-ink/5 hover:text-ink"
              >
                <LogOut className="h-4 w-4" strokeWidth={2} />
                Sign out
              </a>
              <span className="flex gap-3 px-3 font-serif text-[12px] text-ink-soft">
                <a href={`https://${ROOT_DOMAIN}/privacy`} target="_blank" rel="noreferrer" className="hover:text-ink">
                  Privacy
                </a>
                <a href={`https://${ROOT_DOMAIN}/terms`} target="_blank" rel="noreferrer" className="hover:text-ink">
                  Terms
                </a>
              </span>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
