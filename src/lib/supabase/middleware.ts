import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { STASH_PREFIX, VIEW_AS_COOKIE, verifyViewAs } from "@/lib/view-as/cookie";

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
  // Every uploaded photo's <img src> now points here (see
  // lib/google/drive.ts) — an anonymous event visitor has to be able to
  // load it the same way they can reach the event's own page.
  "/api/drive-image",
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
  if (isInviteLinkPath(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function updateSession(request: NextRequest) {
  const guarded = await viewAsGuard(request);
  if (guarded) return guarded;

  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Also refreshes an expiring session so server components see a valid one.
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  return supabaseResponse;
}
