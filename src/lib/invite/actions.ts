"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Couple-only reads/writes, enforced by RLS (see 0013_invite_links.sql) —
// this uses the regular session-aware client, same pattern as
// engagement/actions.ts, so a non-couple caller is rejected at the
// database level regardless of what the UI shows them.

export async function getActiveInviteLink() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invite_links")
    .select("token")
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { token: null, error: error.message };
  return { token: data?.token ?? null, error: null };
}

// Revokes whatever link is currently active (if any) and mints a fresh
// one — used both to create the very first link and to rotate it later
// (e.g. if the old one ends up posted somewhere public). Deliberately one
// active token at a time rather than a growing list: the couple hands out
// a single URL to everyone, not a personal one per invitee.
export async function generateInviteLink() {
  const supabase = await createClient();

  const { error: revokeError } = await supabase
    .from("invite_links")
    .update({ revoked_at: new Date().toISOString() })
    .is("revoked_at", null);
  if (revokeError) return { token: null, error: revokeError.message };

  // 9 random bytes -> 12 base64url characters — short enough to type,
  // long enough that it isn't guessable by trying short strings.
  const token = randomBytes(9).toString("base64url");

  const { error: insertError } = await supabase.from("invite_links").insert({ token });
  if (insertError) return { token: null, error: insertError.message };

  revalidatePath("/account");
  return { token, error: null };
}
