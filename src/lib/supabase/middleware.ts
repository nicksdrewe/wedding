import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { STASH_PREFIX, VIEW_AS_COOKIE, verifyViewAs } from "@/lib/view-as/cookie";
import {
  DEFAULT_WEDDING_SLUG,
  ROOT_DOMAIN,
  SITE_BASE_HEADER,
  WEDDING_COOKIE,
  WEDDING_HEADER,
  WEDDING_PICK_COOKIE,
  WEDDING_SLUG_HEADER,
  isValidSlug,
  slugFromHost,
} from "@/lib/wedding/host";
import { weddingIdForSlug } from "@/lib/wedding/resolve";

const VIEW_AS_STOP_PATH = "/api/view-as/stop";

// "View as" guard (see api/view-as/start). While the couple is looking at the
// site through someone else's session, this is what keeps it safe — the
// banner in the page is only a reminder, nothing relies on it:
//
//   * every write is refused. Server actions and API calls are all non-GET
//     requests, so blocking those makes the borrowed session read-only: the
//     couple can't accidentally RSVP, edit or delete AS that person.
//   * it can't outlive its 30 minutes. The signed marker expires; if the
//     couple's parked session is still present without a valid marker, the
//     browser is sent to the exit route, which swaps their own session back.
//     Without this, an expired marker would leave them silently signed in as
//     the other person with no banner and no write block.
//   * signing out goes through the exit route too — the normal sign-out would
//     end the OTHER person's sessions on all their devices.
//
// Returns a response to short-circuit with, or null to carry on as normal.
async function viewAsGuard(request: NextRequest): Promise<NextResponse | null> {
  const hasStash = request.cookies.getAll().some((c) => c.name.startsWith(STASH_PREFIX));
  const marker = request.cookies.get(VIEW_AS_COOKIE)?.value;
  if (!hasStash && !marker) return null;

  const { pathname } = request.nextUrl;
  if (pathname === VIEW_AS_STOP_PATH) return null;

  const active = (await verifyViewAs(marker)) !== null;

  const toStop = () => {
    const url = request.nextUrl.clone();
    url.pathname = VIEW_AS_STOP_PATH;
    url.search = "";
    // 303 so a blocked POST becomes a GET of the exit route.
    return NextResponse.redirect(url, 303);
  };

  // Marker without a parked session, or a parked session without a live
  // marker (expired / tampered): either way the state is no longer
  // trustworthy — end it.
  if (!active || !hasStash) return toStop();

  if (pathname.startsWith("/logout")) return toStop();

  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    return NextResponse.json(
      { error: "You're viewing the site as someone else — it's read-only. Exit view-as to make changes." },
      { status: 403 }
    );
  }

  return null;
}

// Routes reachable without a session. Everything else requires one.
//
// /api/rsvp was missing here despite its own route comment calling it
// "public, unauthenticated" — pathname for that route is "/api/rsvp/...",
// which doesn't start with "/rsvp", so unauthenticated requests were
// actually being redirected to /login (returning login-page HTML instead
// of JSON) rather than reaching the handler. Listed explicitly now,
// alongside the same for the two newer public API routes.
const PUBLIC_PREFIXES = [
  "/login",
  "/auth",
  "/logout",
  "/rsvp",
  "/no-access",
  // /engagement itself only redirects now (see app/engagement/page.tsx)
  // — kept public so that redirect can actually run for a signed-out
  // visitor instead of being intercepted first. /events is the real,
  // generic events system (see 0017_events_system.sql) it redirects into.
  "/engagement",
  "/events",
  // Public gifts page linked from the landing hero — the wedding-fund ask,
  // no data behind it, so no session needed.
  "/gifts",
  // Ending a view-as must work even if the borrowed session has already
  // expired (the route can only ever END one — see api/view-as/stop).
  "/api/view-as/stop",
  "/api/rsvp",
  "/api/events",
  "/api/auth/request-code",
  // Resend delivering a guest's reply; checks its own signature.
  "/api/email/inbound",
  // Every uploaded photo's <img src> now points here (see
  // lib/google/drive.ts) — an anonymous event visitor has to be able to
  // load it the same way they can reach the event's own page.
  "/api/drive-image",
  // Tells search engines and AI crawlers to keep out (app/robots.ts).
  "/robots.txt",
];

// The reusable invite link (/i/[token], see lib/invite) — checked
// separately from PUBLIC_PREFIXES's plain startsWith matching, which for
// a single-character segment like "/i" would silently make ANY future
// route starting with that letter public too (e.g. "/ideas", "/invoices").
// Matching the full "/i/" segment (or the bare "/i" with nothing after)
// keeps this scoped to exactly the one route it's meant for.
function isInviteLinkPath(pathname: string) {
  return pathname === "/i" || pathname.startsWith("/i/");
}

function isPublic(pathname: string) {
  if (pathname === "/") return true;
  // The style guide (app/design) opens without signing in on a developer's
  // own machine only — it holds sample pieces, no data. On the real site it
  // is behind sign-in like everything else, and couple-only.
  if (process.env.NODE_ENV !== "production" && pathname === "/design") return true;
  if (isInviteLinkPath(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

// Which wedding this address is for (see lib/wedding/host.ts). On preview and
// local addresses ?wedding=<slug> picks one, remembered in a cookie.
async function resolveWedding(request: NextRequest) {
  const host = request.headers.get("host");
  const fromHost = slugFromHost(host);
  const isMainDomain = (host ?? "").split(":")[0].replace(/^www\./, "") === ROOT_DOMAIN;
  let pick: string | null = null;
  let slug = fromHost;
  if (!slug && !isMainDomain) {
    const q = request.nextUrl.searchParams.get("wedding");
    const c = request.cookies.get(WEDDING_PICK_COOKIE)?.value;
    pick = isValidSlug(q) ? q : null;
    slug = pick ?? (isValidSlug(c) ? c : null);
  }
  slug = slug ?? DEFAULT_WEDDING_SLUG;
  let id = await weddingIdForSlug(slug);
  if (!id && !fromHost) {
    slug = DEFAULT_WEDDING_SLUG;
    id = await weddingIdForSlug(slug);
  }
  return { slug, id, unknownSubdomain: !!fromHost && !id, pick };
}

// The commercial site (app/www). On the main domain it is the whole site, so
// "/pricing" there is served from /www/pricing. That switch is held behind
// COMMERCIAL_APEX=1 until the live wedding has moved to its own subdomain.
// Anywhere else (previews, localhost) it is reachable at /www directly.
const COMMERCIAL_PREFIX = "/www";
function commercial(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const host = (request.headers.get("host") ?? "").split(":")[0].replace(/^www\./, "");
  const onApex = host === ROOT_DOMAIN && process.env.COMMERCIAL_APEX === "1";
  const forwarded = new Headers(request.headers);
  forwarded.delete(WEDDING_HEADER);
  forwarded.delete(WEDDING_SLUG_HEADER);
  if (onApex) {
    forwarded.set(SITE_BASE_HEADER, "");
    if (pathname.startsWith("/api/") || pathname === COMMERCIAL_PREFIX || pathname.startsWith(`${COMMERCIAL_PREFIX}/`)) {
      // keep one address per page
      if (pathname.startsWith(COMMERCIAL_PREFIX)) {
        const url = request.nextUrl.clone();
        url.pathname = pathname.slice(COMMERCIAL_PREFIX.length) || "/";
        return NextResponse.redirect(url, 308);
      }
      return NextResponse.next({ request: { headers: forwarded } });
    }
    const url = request.nextUrl.clone();
    url.pathname = `${COMMERCIAL_PREFIX}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url, { request: { headers: forwarded } });
  }
  if (pathname === COMMERCIAL_PREFIX || pathname.startsWith(`${COMMERCIAL_PREFIX}/`)) {
    forwarded.set(SITE_BASE_HEADER, COMMERCIAL_PREFIX);
    return NextResponse.next({ request: { headers: forwarded } });
  }
  return null;
}

export async function updateSession(request: NextRequest) {
  const site = commercial(request);
  if (site) return site;

  const guarded = await viewAsGuard(request);
  if (guarded) return guarded;

  const wedding = await resolveWedding(request);
  if (wedding.unknownSubdomain) {
    // no such wedding: send them to the main site
    return NextResponse.redirect(new URL(`https://${ROOT_DOMAIN}/`));
  }

  // Pass the wedding on to the app. Overwrites anything the browser sent, so
  // the wedding can only ever come from the address.
  const forwarded = new Headers(request.headers);
  forwarded.delete(WEDDING_HEADER);
  forwarded.delete(WEDDING_SLUG_HEADER);
  if (wedding.id) forwarded.set(WEDDING_HEADER, wedding.id);
  forwarded.set(WEDDING_SLUG_HEADER, wedding.slug);
  const next = () => NextResponse.next({ request: { headers: forwarded } });

  let supabaseResponse = next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = next();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Also refreshes an expiring session so server components see a valid one.
  // getClaims checks the signed token on this server (the project uses
  // asymmetric signing keys, which are cached), instead of asking Supabase over
  // the network on every single request the way getUser does. A rotated or
  // expired token is still refreshed here.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;

  const { pathname } = request.nextUrl;

  // Carry over any cookies getUser() rewrote (a rotated refresh token, or the
  // clearing of a session that failed to refresh). A bare redirect drops them,
  // leaving the browser to replay a dead cookie on every subsequent request.
  const withCookies = (response: NextResponse) => {
    supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c));
    return response;
  };

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Remember where they were headed so sign-in can return them there.
    url.searchParams.set("next", pathname);
    return withCookies(NextResponse.redirect(url));
  }

  // A signed-in user hitting the sign-in page should go on to their hub
  // rather than be asked to sign in again.
  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/hub";
    url.search = "";
    return withCookies(NextResponse.redirect(url));
  }

  // The browser's own database client reads the wedding from this cookie.
  if (wedding.id) {
    supabaseResponse.cookies.set(WEDDING_COOKIE, wedding.id, { path: "/", sameSite: "lax", secure: true });
  }
  if (wedding.pick) {
    supabaseResponse.cookies.set(WEDDING_PICK_COOKIE, wedding.pick, { path: "/", sameSite: "lax", secure: true, httpOnly: true });
  }
  return supabaseResponse;
}
