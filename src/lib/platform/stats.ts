import { createAdminClient } from "@/lib/supabase/admin";

// Numbers for the owner's console, across every wedding. Service role, so
// only ever called after requirePlatformAdmin().

const DAY = 86_400_000;
const WEEKS = 12;

export type WeddingRow = {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  status: string;
  plan: string;
  dateLabel: string | null;
  examples: boolean;
  people: number;
  signedIn: number;
  guests: number;
  couples: number;
  attending: number;
  declined: number;
  actions30: number;
  lastActive: string | null;
};

export type PlatformStats = {
  kpis: { weddings: number; couples: number; accounts: number; guests: number; replies: number; active7: number; active30: number; actions30: number };
  weeks: { label: string; weddings: number; accounts: number; actions: number }[];
  engagement: { label: string; value: number; tone: string }[];
  weddings: WeddingRow[];
};

type AuthUser = { id: string; email?: string; created_at: string; last_sign_in_at?: string | null };

async function allAuthUsers(): Promise<AuthUser[]> {
  const admin = createAdminClient();
  const out: AuthUser[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    out.push(...(data.users as AuthUser[]));
    if (data.users.length < 1000) break;
  }
  return out;
}

function weekStart(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
}

export async function loadPlatformStats(): Promise<PlatformStats> {
  const admin = createAdminClient();
  const now = Date.now();
  const since = new Date(now - WEEKS * 7 * DAY).toISOString();

  const activityTables = ["tasks", "comments", "page_options", "category_pages", "comms_messages", "big_day_items", "diary_entries"] as const;
  const [{ data: weddings }, { data: contacts }, { data: rsvps }, users, ...activity] = await Promise.all([
    admin.from("weddings").select("*").order("created_at", { ascending: false }),
    admin.from("contacts").select("wedding_id, role, user_id"),
    admin.from("rsvps").select("wedding_id, attending"),
    allAuthUsers(),
    ...activityTables.map((t) => admin.from(t).select("wedding_id, created_at").gte("created_at", since)),
  ]);

  const actions = activity.flatMap((r) => (r.data ?? []) as { wedding_id: string; created_at: string }[]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const signIn = (u?: AuthUser) => (u?.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0);

  // weekly series
  const first = weekStart(new Date(now - (WEEKS - 1) * 7 * DAY));
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(first.getTime() + i * 7 * DAY);
    return { start: start.getTime(), label: start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), weddings: 0, accounts: 0, actions: 0 };
  });
  const bucket = (iso: string) => {
    const t = new Date(iso).getTime();
    const i = Math.floor((t - first.getTime()) / (7 * DAY));
    return i >= 0 && i < WEEKS ? weeks[i] : null;
  };
  for (const w of weddings ?? []) {
    const b = bucket(w.created_at);
    if (b) b.weddings++;
  }
  for (const u of users) {
    const b = bucket(u.created_at);
    if (b) b.accounts++;
  }
  for (const a of actions) {
    const b = bucket(a.created_at);
    if (b) b.actions++;
  }

  // per wedding
  const rows: WeddingRow[] = (weddings ?? []).map((w) => {
    const cs = (contacts ?? []).filter((c) => c.wedding_id === w.id);
    const members = [...new Set(cs.map((c) => c.user_id).filter(Boolean) as string[])];
    const last = Math.max(0, ...members.map((id) => signIn(userById.get(id))));
    const rs = (rsvps ?? []).filter((r) => r.wedding_id === w.id);
    return {
      id: w.id,
      slug: w.slug,
      name: w.display_name,
      createdAt: w.created_at,
      status: w.status,
      plan: w.plan,
      dateLabel: w.date_label ?? w.wedding_date ?? null,
      examples: !!w.show_examples,
      people: cs.length,
      signedIn: members.length,
      guests: cs.filter((c) => c.role === "guest").length,
      couples: cs.filter((c) => c.role === "couple").length,
      attending: rs.filter((r) => r.attending === true).length,
      declined: rs.filter((r) => r.attending === false).length,
      actions30: actions.filter((a) => a.wedding_id === w.id && new Date(a.created_at).getTime() > now - 30 * DAY).length,
      lastActive: last ? new Date(last).toISOString() : null,
    };
  });

  const coupleUsers = new Set((contacts ?? []).filter((c) => c.role === "couple" && c.user_id).map((c) => c.user_id));
  const active7 = users.filter((u) => signIn(u) > now - 7 * DAY).length;
  const active30 = users.filter((u) => signIn(u) > now - 30 * DAY).length;
  const never = users.filter((u) => !u.last_sign_in_at).length;

  return {
    kpis: {
      weddings: rows.length,
      couples: coupleUsers.size,
      accounts: users.length,
      guests: (contacts ?? []).length,
      replies: (rsvps ?? []).filter((r) => r.attending !== null).length,
      active7,
      active30,
      actions30: actions.filter((a) => new Date(a.created_at).getTime() > now - 30 * DAY).length,
    },
    weeks: weeks.map(({ label, weddings, accounts, actions }) => ({ label, weddings, accounts, actions })),
    engagement: [
      { label: "Active this week", value: active7, tone: "#5ee0a0" },
      { label: "Active this month", value: Math.max(0, active30 - active7), tone: "#f5c451" },
      { label: "Quieter", value: Math.max(0, users.length - active30 - never), tone: "#ff7a90" },
      { label: "Never signed in", value: never, tone: "#7d8aa8" },
    ],
    weddings: rows,
  };
}
