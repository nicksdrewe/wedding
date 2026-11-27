"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { findAuthUserByEmail, isBanned } from "@/lib/accounts/status";
import { sendEmail } from "@/lib/email/resend";
import { ROOT_DOMAIN, isValidSlug, weddingUrl } from "@/lib/wedding/host";

// Signing up a new wedding from the commercial site. Free, invite-only alpha:
// an invite code is needed. The database makes
// the final call on the code and the address (fn_create_wedding).

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function limited(bucket: string, max: number) {
  const { ok } = await checkRateLimit(`${bucket}:${await ip()}`, { max, windowSeconds: 60 * 60 });
  return !ok;
}

export async function checkAddress(slug: string): Promise<{ available: boolean; reason: string | null }> {
  if (!isValidSlug(slug)) {
    return { available: false, reason: "3 to 40 letters or numbers (a dash in the middle is fine)." };
  }
  const { data, error } = await createAdminClient().rpc("fn_slug_available", { p_slug: slug });
  if (error) return { available: false, reason: "Couldn't check that just now. Try again in a moment." };
  return data ? { available: true, reason: null } : { available: false, reason: "That address is taken. Try another." };
}

export async function applyCode(code: string): Promise<{ percent: number | null; error: string | null }> {
  if (!code.trim()) return { percent: null, error: "Enter a code." };
  if (await limited("signup-code", 30)) return { percent: null, error: "Too many tries. Please wait a little while." };
  const { data, error } = await createAdminClient().rpc("fn_check_signup_code", { p_code: code });
  if (error) return { percent: null, error: "Couldn't check that code just now. Try again in a moment." };
  if (data == null) return { percent: null, error: "That code isn't valid, or has been used up." };
  return { percent: data as number, error: null };
}

const signup = z.object({
  partnerOne: z.string().trim().min(1, "Add both names.").max(60),
  partnerTwo: z.string().trim().min(1, "Add both names.").max(60),
  dateLabel: z.string().trim().max(60).optional().default(""),
  slug: z.string().trim().toLowerCase(),
  fullName: z.string().trim().min(1, "Add your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email.").max(320),
  code: z.string().trim().min(1, "Enter your code.").max(60),
});

export type SignupResult =
  | { ok: true; slug: string; siteUrl: string; email: string }
  | { ok: false; error: string; field?: string };

export async function createWedding(input: z.input<typeof signup>): Promise<SignupResult> {
  const parsed = signup.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue.message, field: String(issue.path[0] ?? "") };
  }
  const d = parsed.data;
  if (await limited("signup", 8)) return { ok: false, error: "Too many signups from here. Please wait a little while." };

  const address = await checkAddress(d.slug);
  if (!address.available) return { ok: false, error: address.reason ?? "Choose another address.", field: "slug" };

  const code = await applyCode(d.code);
  if (code.percent == null) return { ok: false, error: code.error ?? "That code isn't valid.", field: "code" };
  if (code.percent < 100) {
    return { ok: false, error: "That code isn't an alpha invite. Check the code you were sent.", field: "code" };
  }

  const admin = createAdminClient();

  // One login for every wedding someone is part of. No password is set here:
  // they sign in with a code sent to this email, which is what proves it's theirs.
  let user = await findAuthUserByEmail(d.email);
  if (user && isBanned(user)) return { ok: false, error: "That email can't be used to sign up.", field: "email" };
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: d.email,
      email_confirm: true,
      user_metadata: { full_name: d.fullName },
    });
    if (error || !data.user) return { ok: false, error: "Couldn't set up your sign-in just now. Try again in a moment." };
    user = { id: data.user.id, email: d.email, lastSignInAt: null, bannedUntil: null };
  }

  const { data: newWeddingId, error } = await admin.rpc("fn_create_wedding", {
    p_slug: d.slug,
    p_partner_one: d.partnerOne,
    p_partner_two: d.partnerTwo,
    p_date_label: d.dateLabel,
    p_email: d.email,
    p_full_name: d.fullName,
    p_user: user.id,
    p_code: d.code,
  });
  if (error) {
    if (error.message.includes("address taken")) return { ok: false, error: "That address was just taken. Try another.", field: "slug" };
    if (error.message.includes("code not valid")) return { ok: false, error: "That code has just been used up.", field: "code" };
    return { ok: false, error: "Something went wrong making your site. Try again in a moment." };
  }

  // New sites start with the example plans switched on, so there's something
  // to explore straight away (the couple can clear them with one switch).
  if (newWeddingId) await admin.rpc("fn_set_examples", { p_wedding: newWeddingId as string, p_on: true });

  const host = (await headers()).get("host")?.split(":")[0] ?? "";
  const onMainDomain = host.replace(/^www\./, "") === ROOT_DOMAIN;
  const siteUrl = onMainDomain ? weddingUrl(d.slug, "/login") : `/login?wedding=${d.slug}`;

  // A welcome note with the address. Best effort: the page shows it too.
  const names = `${d.partnerOne} & ${d.partnerTwo}`;
  await sendEmail({
    to: d.email,
    subject: `${names}: your wedding site is ready`,
    html: welcomeEmail(names, weddingUrl(d.slug)),
  }).catch(() => null);

  return { ok: true, slug: d.slug, siteUrl, email: d.email };
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function welcomeEmail(names: string, url: string) {
  return `<div style="font-family:Georgia,serif;color:#232520;background:#f4f1ec;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:#fffdf9;border-radius:16px;padding:32px">
    <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#5b5a52;margin:0">Weddings Weddings</p>
    <h1 style="font-weight:500;font-size:26px;margin:12px 0 8px">${esc(names)}, your site is ready</h1>
    <p style="font-size:16px;line-height:1.6;color:#5b5a52">It lives at <a href="${esc(url)}" style="color:#4c6b52">${esc(url.replace(/^https:\/\//, "").replace(/\/$/, ""))}</a>.
    Sign in with this email and we'll send you a code. No password to remember.</p>
    <p style="margin:24px 0"><a href="${esc(url)}login" style="background:#1d2a21;color:#f4f1ec;text-decoration:none;padding:12px 22px;border-radius:999px;font-family:Arial,sans-serif;font-size:14px">Open your site</a></p>
    <p style="font-size:14px;color:#5b5a52">You're one of our alpha couples, so it's free while we build it together.</p>
  </div>
</div>`;
}
