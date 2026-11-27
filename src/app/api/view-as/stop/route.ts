import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWeddingId } from "@/lib/wedding/current";
import {
  AUTH_COOKIE_PATTERN,
  STASH_PREFIX,
  VIEW_AS_COOKIE,
  VIEW_AS_UI_COOKIE,
  verifyViewAs,
} from "@/lib/view-as/cookie";

// Ends "view as": closes the borrowed session (that one session only — the
// person's own devices stay signed in) and puts the couple's parked session
// back. Deliberately reachable by plain GET and safe to hit at any time:
// all it can ever do is END a view-as, so there is nothing for a stray link
// to abuse. Middleware sends people here automatically when the 30 minutes
// are up, or if they try to sign out while viewing.
export const dynamic = "force-dynamic";

async function stop(request: Request) {
  const origin = new URL(request.url).origin;
  const cookieStore = await cookies();

  const payload = await verifyViewAs(cookieStore.get(VIEW_AS_COOKIE)?.value);
  const stash = cookieStore.getAll().filter((c) => c.name.startsWith(STASH_PREFIX));
  const secure = process.env.NODE_ENV === "production";

  const clearMarkers = () => {
    cookieStore.delete(VIEW_AS_COOKIE);
    cookieStore.delete(VIEW_AS_UI_COOKIE);
  };

  // Nothing parked and no live marker: there is no view-as to end.
  if (stash.length === 0 && !payload) {
    clearMarkers();
    return NextResponse.redirect(`${origin}/hub`, 303);
  }

  // From here on the live session cookies are the borrowed ones (they were
  // swapped in at start). End that single session server-side. scope:
  // "local" is essential — the default would sign the real person out of
  // every device they own.
  try {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Already expired or gone — nothing left to end.
  }
  // Belt and braces: make sure no borrowed cookie survives even if the
  // sign-out call above couldn't reach Supabase.
  for (const c of cookieStore.getAll()) {
    if (AUTH_COOKIE_PATTERN.test(c.name)) cookieStore.delete(c.name);
  }

  if (payload) {
    const { error } = await createAdminClient(await getWeddingId()).from("admin_audit").insert({
      actor_id: payload.actorId,
      action: "viewas.stop",
      target_contact_id: payload.targetContactId,
      detail: {},
    });
    if (error) console.error("admin_audit write failed:", error.message);
  }

  clearMarkers();

  if (stash.length === 0) {
    // The parked session is gone (cookies cleared by hand, say). The borrowed
    // one has been ended above, so the only safe place left is sign-in.
    return NextResponse.redirect(`${origin}/login`, 303);
  }

  for (const c of stash) {
    const originalName = c.name.slice(STASH_PREFIX.length);
    // Only ever restore something that is actually a session cookie name.
    if (AUTH_COOKIE_PATTERN.test(originalName)) {
      // Same attributes Supabase's own cookie handling uses.
      cookieStore.set(originalName, c.value, { path: "/", sameSite: "lax", secure, maxAge: 400 * 24 * 60 * 60 });
    }
    cookieStore.delete(c.name);
  }

  return NextResponse.redirect(`${origin}/guests`, 303);
}

export const GET = stop;
export const POST = stop;
