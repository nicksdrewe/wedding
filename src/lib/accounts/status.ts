import { createAdminClient } from "@/lib/supabase/admin";
import type { AccountStatus } from "./types";

// Server-only (service role). Supabase's admin API is the only place the
// real list of accounts lives — auth.users isn't reachable through normal
// queries — so everything that needs "does this person have an account" goes
// through here.

export type AuthUserSummary = {
  id: string;
  email: string;
  lastSignInAt: string | null;
  bannedUntil: string | null;
};

// Every account, paged. A wedding site has dozens of accounts, not
// thousands, so reading them all in one or two requests is simplest and
// keeps lookups consistent.
export async function listAuthUsers(): Promise<AuthUserSummary[]> {
  const admin = createAdminClient();
  const out: AuthUserSummary[] = [];
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    for (const u of data.users) {
      if (!u.email) continue;
      out.push({
        id: u.id,
        email: u.email.toLowerCase(),
        lastSignInAt: u.last_sign_in_at ?? null,
        bannedUntil: (u as { banned_until?: string | null }).banned_until ?? null,
      });
    }
    if (data.users.length < perPage) break;
  }
  return out;
}

export async function findAuthUserByEmail(email: string): Promise<AuthUserSummary | null> {
  const target = email.trim().toLowerCase();
  return (await listAuthUsers()).find((u) => u.email === target) ?? null;
}

export function isBanned(user: { bannedUntil: string | null }): boolean {
  return !!user.bannedUntil && new Date(user.bannedUntil).getTime() > Date.now();
}

type ContactForStatus = { id: string; email: string | null; parent_contact_id: string | null };

// One status per contact, for the guest list. Plus-ones (parent_contact_id
// set) never get accounts and are left out.
export async function loadAccountStatuses(contacts: ContactForStatus[]): Promise<Record<string, AccountStatus>> {
  const users = await listAuthUsers();
  const byEmail = new Map(users.map((u) => [u.email, u]));

  const topLevel = contacts.filter((c) => !c.parent_contact_id);
  const emailCounts = new Map<string, number>();
  for (const c of topLevel) {
    if (!c.email) continue;
    const key = c.email.trim().toLowerCase();
    emailCounts.set(key, (emailCounts.get(key) ?? 0) + 1);
  }

  const result: Record<string, AccountStatus> = {};
  for (const c of topLevel) {
    if (!c.email) {
      result[c.id] = { state: "no-email", lastSignInAt: null };
      continue;
    }
    const key = c.email.trim().toLowerCase();
    const user = byEmail.get(key);
    if (user) {
      result[c.id] = {
        state: isBanned(user) ? "disabled" : user.lastSignInAt ? "active" : "invited",
        lastSignInAt: user.lastSignInAt,
      };
    } else if ((emailCounts.get(key) ?? 0) > 1) {
      result[c.id] = { state: "duplicate", lastSignInAt: null };
    } else {
      result[c.id] = { state: "none", lastSignInAt: null };
    }
  }
  return result;
}
