import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWeddingId } from "@/lib/wedding/current";
import { getCurrentProfile } from "@/lib/auth/roles";
import { findAuthUserByEmail, isBanned } from "@/lib/accounts/status";
import {
  AUTH_COOKIE_PATTERN,
  STASH_PREFIX,
  VIEW_AS_COOKIE,
  VIEW_AS_MAX_AGE_SECONDS,
  VIEW_AS_UI_COOKIE,
  signViewAs,
  verifyViewAs,
} from "@/lib/view-as/cookie";

// Starts "view as": swaps this browser's session for a real, short-lived
// session belonging to the chosen person, so the couple sees EXACTLY what
// that person sees — every access rule in the database keys off who is
// signed in, so nothing short of their actual session is faithful.
//
// Safety properties, all enforced here or in middleware (never by the UI):
//   * only a couple member can start it, checked against their real session;
//   * never nested, never onto another couple member or oneself;
//   * the couple's own session is parked in httpOnly cookies and restored on
//     exit (api/view-as/stop);
//   * while it lasts, middleware refuses every write (read-only) and ends it
//     automatically at 30 minutes;
//   * start and stop are both written to admin_audit.
export const dynamic = "force-dynamic";

const STASH_MAX_AGE_SECONDS = 8 * 60 * 60;

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/guests?viewAsError=${encodeURIComponent(message)}`, 303);

  // Same-site form posts only. (The session cookie is SameSite=Lax, so a
  // cross-site POST arrives signed-out anyway; this is a second lock.)
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== origin) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const cookieStore = await cookies();
  const alreadyViewing =
    (await verifyViewAs(cookieStore.get(VIEW_AS_COOKIE)?.value)) !== null ||
    cookieStore.getAll().some((c) => c.name.startsWith(STASH_PREFIX));
  if (alreadyViewing) return fail("You're already viewing as someone — exit that first.");

  const actor = await getCurrentProfile();
  if (!actor || actor.role !== "couple") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const form = await request.formData();
  const contactId = z.string().uuid().safeParse(form.get("contactId"));
  if (!contactId.success) return fail("That guest couldn't be found.");

  const admin = createAdminClient(await getWeddingId());
  const { data: contact } = await admin
    .from("contacts")
    .select("id, full_name, email, role, parent_contact_id")
    .eq("id", contactId.data)
    .maybeSingle();
  if (!contact || contact.parent_contact_id || !contact.email) return fail("That guest doesn't have an account.");
  if (contact.role === "couple") return fail("View-as isn't available for your own accounts.");

  const email = contact.email.trim().toLowerCase();
  const target = await findAuthUserByEmail(email);
  if (!target) return fail("They don't have an account yet — create one first.");
  if (target.id === actor.id) return fail("That's you.");
  if (isBanned(target)) return fail("Their account is switched off.");

  // The account must be the one linked to THIS guest-list entry, so the
  // name in the banner and the person whose access is shown can't diverge.
  const { data: targetProfile } = await admin
    .from("profiles")
    .select("id, role, contact_id")
    .eq("id", target.id)
    .maybeSingle();
  if (!targetProfile || targetProfile.contact_id !== contact.id || targetProfile.role === "couple") {
    return fail("That account isn't linked to this guest-list entry.");
  }

  const ownAuthCookies = cookieStore.getAll().filter((c) => AUTH_COOKIE_PATTERN.test(c.name));
  if (ownAuthCookies.length === 0) return fail("Couldn't find your own session — sign in again and retry.");

  // Mint the person's session WITHOUT touching any cookie yet: a one-time
  // sign-in token created by the admin API (no email is sent), exchanged by
  // a throwaway in-memory client.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) return fail(`Couldn't start view-as: ${linkError?.message ?? "no token returned"}`);

  const throwaway = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: verified, error: verifyError } = await throwaway.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  const session = verified?.session;
  if (verifyError || !session) return fail(`Couldn't start view-as: ${verifyError?.message ?? "no session returned"}`);
  if (session.user.id !== target.id) {
    await throwaway.auth.signOut({ scope: "local" }).catch(() => {});
    return fail("Couldn't start view-as: the session didn't match the person chosen.");
  }

  // Put the "last signed in" time back so the guest list doesn't claim they
  // signed in when it was the couple looking. Best effort (see 0036).
  await admin
    .rpc("fn_admin_restore_last_sign_in", { p_user_id: target.id, p_last_sign_in_at: target.lastSignInAt })
    .then(
      () => undefined,
      () => undefined
    );

  const secure = process.env.NODE_ENV === "production";

  // Park the couple's own session cookies, then replace the live ones.
  for (const c of ownAuthCookies) {
    cookieStore.set(`${STASH_PREFIX}${c.name}`, c.value, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: STASH_MAX_AGE_SECONDS,
    });
    cookieStore.delete(c.name);
  }

  // Written through Supabase's own cookie handling so the format (encoding,
  // chunking) is exactly what the rest of the app reads. getAll() is empty
  // on purpose: this client must not see, refresh or sign out the couple's
  // session — it only writes the new one.
  const writer = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [],
      setAll: (toSet) => toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });
  const { error: setError } = await writer.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  const wroteSession = cookieStore.getAll().some((c) => AUTH_COOKIE_PATTERN.test(c.name) && c.value);

  if (setError || !wroteSession) {
    // Undo: restore the couple's cookies exactly, end the minted session.
    for (const c of ownAuthCookies) {
      cookieStore.set(c.name, c.value, { path: "/", sameSite: "lax", secure, maxAge: 400 * 24 * 60 * 60 });
      cookieStore.delete(`${STASH_PREFIX}${c.name}`);
    }
    await throwaway.auth.signOut({ scope: "local" }).catch(() => {});
    return fail(`Couldn't start view-as: ${setError?.message ?? "the session couldn't be saved"}`);
  }

  const exp = Math.floor(Date.now() / 1000) + VIEW_AS_MAX_AGE_SECONDS;
  const targetName = contact.full_name ?? email;
  cookieStore.set(
    VIEW_AS_COOKIE,
    await signViewAs({
      actorId: actor.id,
      targetUserId: target.id,
      targetContactId: contact.id,
      targetName,
      exp,
    }),
    { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: VIEW_AS_MAX_AGE_SECONDS }
  );
  // Display only — read by the banner, trusted by nothing.
  cookieStore.set(VIEW_AS_UI_COOKIE, encodeURIComponent(targetName), {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: VIEW_AS_MAX_AGE_SECONDS,
  });

  const { error: auditError } = await admin.from("admin_audit").insert({
    actor_id: actor.id,
    action: "viewas.start",
    target_contact_id: contact.id,
    target_email: email,
    detail: { minutes: VIEW_AS_MAX_AGE_SECONDS / 60, read_only: true },
  });
  if (auditError) console.error("admin_audit write failed:", auditError.message);

  // Full navigation (303 after POST) so nothing rendered for the couple's
  // own session lingers on screen.
  return NextResponse.redirect(`${origin}/hub`, 303);
}
