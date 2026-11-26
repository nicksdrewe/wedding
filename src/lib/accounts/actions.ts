"use server";

// The couple managing other people's accounts from the guest list. Every
// action here:
//   * checks, on the server, that the caller IS a couple member — the
//     buttons being hidden from everyone else is cosmetic, this is the gate;
//   * never shows, logs or returns a password, token or sign-in code;
//   * writes an admin_audit line (who / what / whose).
//
// Accounts are GIVEN, not self-created: sign-in only works for an account
// that exists (see api/auth/request-code and components/SignInFields.tsx), so
// being on the guest list alone never grants access.

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWeddingId } from "@/lib/wedding/current";
import { getCurrentProfile } from "@/lib/auth/roles";
import { sendEmail } from "@/lib/email/resend";
import { inviteEmail } from "./invite-email";
import { findAuthUserByEmail, isBanned } from "./status";
import { getCurrentWedding } from "@/lib/wedding/current";
import { weddingUrl } from "@/lib/wedding/host";

type Result = { error: string | null; notice?: string };

const idSchema = z.string().uuid();

async function requireCouple() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "couple") return null;
  return profile;
}

// The contact a button was pressed on, with everything a safe decision needs.
async function loadTarget(contactId: string) {
  const parsed = idSchema.safeParse(contactId);
  if (!parsed.success) return { ok: false as const, error: "That guest couldn't be found." };

  const admin = createAdminClient(await getWeddingId());
  const { data: contact } = await admin
    .from("contacts")
    .select("id, full_name, email, role, parent_contact_id")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!contact) return { ok: false as const, error: "That guest couldn't be found." };
  if (contact.parent_contact_id) return { ok: false as const, error: "Plus-ones don't have accounts." };
  if (!contact.email) return { ok: false as const, error: "Add an email address for them first — an account needs one." };

  const email = contact.email.trim().toLowerCase();
  // Two guest-list entries sharing one email make "which person is this
  // account?" ambiguous (the database links the first match). Don't guess.
  const { count } = await admin
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .is("parent_contact_id", null)
    .ilike("email", email.replace(/[%_\\*]/g, "\\$&"));
  if ((count ?? 0) > 1) {
    return { ok: false as const, error: "Another guest-list entry has the same email address — fix that first so the account goes to the right person." };
  }

  return { ok: true as const, contact, email };
}

async function audit(
  actorId: string,
  action: string,
  target: { contactId: string; email: string },
  detail: Record<string, unknown> = {}
) {
  // Best effort: a failure to write the trail shouldn't undo a change that
  // already happened, but it is reported to the server log.
  const { error } = await createAdminClient(await getWeddingId()).from("admin_audit").insert({
    actor_id: actorId,
    action,
    target_contact_id: target.contactId,
    target_email: target.email,
    detail,
  });
  if (error) console.error("admin_audit write failed:", error.message);
}

async function sendInviteTo(contact: { full_name: string | null }, email: string, reason: "new" | "reset") {
  const wedding = await getCurrentWedding();
  const { subject, html } = inviteEmail({
    fullName: contact.full_name,
    email,
    reason,
    coupleName: wedding?.display_name ?? "Weddings Weddings",
    baseUrl: wedding && wedding.slug !== "nickellie" ? weddingUrl(wedding.slug) : undefined,
  });
  return sendEmail({ to: email, subject, html });
}

export async function createAccount(contactId: string, sendInvite: boolean): Promise<Result> {
  const actor = await requireCouple();
  if (!actor) return { error: "Only the couple can do that." };

  const target = await loadTarget(contactId);
  if (!target.ok) return { error: target.error };
  const { contact, email } = target;

  if (await findAuthUserByEmail(email)) return { error: "They already have an account." };

  const admin = createAdminClient(await getWeddingId());
  // email_confirm: true — the couple vouching for the address is the
  // confirmation. That also means their first sign-in email is the regular
  // sign-in-code one, not Supabase's "confirm your email" link.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: contact.full_name },
  });
  if (error || !data.user) return { error: error?.message ?? "Couldn't create the account." };

  // A database trigger (0002) creates the matching profile with the role
  // the contact already has. Confirm it did, rather than assume.
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, contact_id")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile || profile.contact_id !== contact.id) {
    return {
      error:
        "The account was created but wasn't linked to this guest-list entry. Check the guest list entry's email and role, then try again.",
    };
  }

  await audit(actor.id, "account.create", { contactId: contact.id, email }, { role: profile.role, invited: sendInvite });
  revalidatePath("/guests");

  if (sendInvite) {
    const sent = await sendInviteTo(contact, email, "new");
    if (sent.error) return { error: null, notice: `Account created, but the invite email didn't send: ${sent.error}` };
    return { error: null, notice: "Account created and invite sent." };
  }
  return { error: null, notice: "Account created." };
}

export async function sendAccountInvite(contactId: string): Promise<Result> {
  const actor = await requireCouple();
  if (!actor) return { error: "Only the couple can do that." };

  const target = await loadTarget(contactId);
  if (!target.ok) return { error: target.error };
  const { contact, email } = target;

  const user = await findAuthUserByEmail(email);
  if (!user) return { error: "They don't have an account yet — create one first." };
  if (isBanned(user)) return { error: "Their account is switched off — re-enable it first." };

  const sent = await sendInviteTo(contact, email, "new");
  if (sent.error) return { error: `The email didn't send: ${sent.error}` };

  await audit(actor.id, "account.invite", { contactId: contact.id, email });
  return { error: null, notice: "Invite sent." };
}

export async function resetAccount(contactId: string): Promise<Result> {
  const actor = await requireCouple();
  if (!actor) return { error: "Only the couple can do that." };

  const target = await loadTarget(contactId);
  if (!target.ok) return { error: target.error };
  const { contact, email } = target;

  const user = await findAuthUserByEmail(email);
  if (!user) return { error: "They don't have an account." };
  if (user.id === actor.id) return { error: "Use My Details to change your own password." };
  if (contact.role === "couple") return { error: "That would lock out one of you — not done from here." };

  const admin = createAdminClient(await getWeddingId());
  // There is no way to "clear" a password through the admin API, so replace
  // it with a long random one nobody (including us) ever sees. The person is
  // then in the same position as someone who never set one: sign in with a
  // code, and set a new password from My Details if they want one.
  const { error } = await admin.auth.admin.updateUserById(user.id, { password: randomBytes(32).toString("hex") });
  if (error) return { error: error.message };
  const { error: revokeError } = await admin.rpc("fn_admin_revoke_sessions", { p_user_id: user.id });
  if (revokeError) {
    return {
      error: `The password was reset, but signing them out everywhere failed (${revokeError.message}). Has migration 0035 been run?`,
    };
  }

  await audit(actor.id, "account.reset", { contactId: contact.id, email });
  const sent = await sendInviteTo(contact, email, "reset");
  revalidatePath("/guests");
  return {
    error: null,
    notice: sent.error
      ? `Password reset and signed out everywhere, but the email didn't send: ${sent.error}`
      : "Password reset, signed out everywhere, and they've been emailed how to get back in.",
  };
}

export async function signOutEverywhere(contactId: string): Promise<Result> {
  const actor = await requireCouple();
  if (!actor) return { error: "Only the couple can do that." };

  const target = await loadTarget(contactId);
  if (!target.ok) return { error: target.error };
  const { contact, email } = target;

  const user = await findAuthUserByEmail(email);
  if (!user) return { error: "They don't have an account." };

  const { error } = await createAdminClient(await getWeddingId()).rpc("fn_admin_revoke_sessions", { p_user_id: user.id });
  if (error) return { error: `${error.message} — has migration 0035 been run?` };

  await audit(actor.id, "account.signout", { contactId: contact.id, email });
  return { error: null, notice: "Signed out of every device." };
}

export async function setAccountDisabled(contactId: string, disabled: boolean): Promise<Result> {
  const actor = await requireCouple();
  if (!actor) return { error: "Only the couple can do that." };

  const target = await loadTarget(contactId);
  if (!target.ok) return { error: target.error };
  const { contact, email } = target;

  const user = await findAuthUserByEmail(email);
  if (!user) return { error: "They don't have an account." };
  if (user.id === actor.id) return { error: "You can't switch off your own account." };
  if (contact.role === "couple") return { error: "That would lock out one of you — not done from here." };

  const admin = createAdminClient(await getWeddingId());
  // 100 years is "indefinitely" to Supabase; "none" lifts it.
  const { error } = await admin.auth.admin.updateUserById(user.id, { ban_duration: disabled ? "876000h" : "none" });
  if (error) return { error: error.message };
  if (disabled) await admin.rpc("fn_admin_revoke_sessions", { p_user_id: user.id });

  await audit(actor.id, disabled ? "account.disable" : "account.enable", { contactId: contact.id, email });
  revalidatePath("/guests");
  return { error: null, notice: disabled ? "Account switched off and signed out." : "Account switched back on." };
}
