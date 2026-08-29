import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes reachable without a session. Everything else requires one.
const PUBLIC_PREFIXES = ["/login", "/auth", "/logout", "/rsvp", "/no-access"];

function isPublic(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function updateSession(request: NextRequest) {
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
