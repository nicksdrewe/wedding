import { createAdminClient } from "@/lib/supabase/admin";
import { paletteFor, type WeddingTheme } from "@/lib/wedding/theme";

// Everything for the "Your weddings" page: each wedding the signed-in person
// is on the list for, what they're invited to and what needs them. Service
// role, always filtered to the person's own contact rows.

export type MyEvent = { id: string; name: string; startsAt: string | null; location: string | null; rsvpId: string | null; attending: boolean | null };
export type MyNotice = { id: string; title: string; at: string };
export type MyWedding = {
  id: string;
  slug: string;
  name: string;
  date: string | null;
  dateLabel: string | null;
  role: string;
  contactId: string;
  rsvpToken: string;
  colours: { ink: string; ground: string; accent: string };
  events: MyEvent[];
  notices: MyNotice[];
  myTasks: number;
  couple: { unread: number; openTasks: number; awaiting: number; attending: number } | null;
};

const ROLE_RANK: Record<string, number> = { couple: 0, wedding_party: 1, family: 2, guest: 3 };

export async function loadMyWeddings(userId: string): Promise<MyWedding[]> {
  const admin = createAdminClient();
  const { data: mine } = await admin.from("contacts").select("id, wedding_id, role, rsvp_token").eq("user_id", userId);
  if (!mine?.length) return [];
  const ids = [...new Set(mine.map((c) => c.wedding_id as string))];
  const contactIds = mine.map((c) => c.id as string);
  const now = new Date().toISOString();

  const [{ data: weddings }, { data: events }, { data: rsvps }, { data: sends }, { data: tasks }] = await Promise.all([
    admin.from("weddings").select("id, slug, display_name, wedding_date, date_label, theme, status").in("id", ids),
    admin.from("events").select("id, wedding_id, name, starts_at, location").in("wedding_id", ids).eq("rsvp_enabled", true).or(`starts_at.gte.${now},starts_at.is.null`).order("starts_at", { ascending: true }),
    admin.from("rsvps").select("id, contact_id, event_id, attending").in("contact_id", contactIds),
    admin.from("comms_recipients").select("id, contact_id, sent_at, comms_messages(subject)").in("contact_id", contactIds).eq("status", "sent").order("sent_at", { ascending: false }).limit(30),
    admin.from("tasks").select("id, owner_contact_id").in("owner_contact_id", contactIds).neq("status", "done"),
  ]);

  const coupleIds = mine.filter((c) => c.role === "couple").map((c) => c.wedding_id as string);
  const coupleStats = new Map<string, MyWedding["couple"]>();
  if (coupleIds.length) {
    const [{ data: inbox }, { data: open }, { data: allRsvps }] = await Promise.all([
      admin.from("inbound_emails").select("wedding_id").in("wedding_id", coupleIds).is("read_at", null),
      admin.from("tasks").select("wedding_id").in("wedding_id", coupleIds).neq("status", "done").eq("is_example", false),
      admin.from("rsvps").select("wedding_id, attending").in("wedding_id", coupleIds),
    ]);
    for (const w of coupleIds) {
      const rs = (allRsvps ?? []).filter((r) => r.wedding_id === w);
      coupleStats.set(w, {
        unread: (inbox ?? []).filter((r) => r.wedding_id === w).length,
        openTasks: (open ?? []).filter((r) => r.wedding_id === w).length,
        awaiting: rs.filter((r) => r.attending === null).length,
        attending: rs.filter((r) => r.attending === true).length,
      });
    }
  }

  const out: MyWedding[] = [];
  for (const w of weddings ?? []) {
    if (w.status !== "active") continue;
    // a person can be on one list twice; take their strongest role
    const cs = mine.filter((c) => c.wedding_id === w.id).sort((a, b) => (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9));
    const me = cs[0];
    const myContactIds = new Set(cs.map((c) => c.id));
    const p = paletteFor(w.theme as WeddingTheme);
    const accent = (w.theme as WeddingTheme)?.accent;
    out.push({
      id: w.id,
      slug: w.slug,
      name: w.display_name,
      date: w.wedding_date,
      dateLabel: w.date_label,
      role: me.role,
      contactId: me.id,
      rsvpToken: me.rsvp_token,
      colours: {
        ink: p.base.forest,
        ground: p.base.cream,
        accent: accent && /^#[0-9a-f]{6}$/i.test(accent) ? accent : Object.values(p.sections)[0] ?? p.base.forest,
      },
      events: (events ?? [])
        .filter((e) => e.wedding_id === w.id)
        .slice(0, 4)
        .map((e) => {
          const r = (rsvps ?? []).find((x) => x.event_id === e.id && x.contact_id === me.id);
          return { id: e.id, name: e.name, startsAt: e.starts_at, location: e.location, rsvpId: r?.id ?? null, attending: r ? r.attending : null };
        }),
      notices: (sends ?? [])
        .filter((s) => myContactIds.has(s.contact_id))
        .slice(0, 3)
        .map((s) => ({
          id: s.id,
          title: ((Array.isArray(s.comms_messages) ? s.comms_messages[0] : s.comms_messages) as { subject?: string } | null)?.subject ?? "A message",
          at: s.sent_at as string,
        })),
      myTasks: (tasks ?? []).filter((t) => myContactIds.has(t.owner_contact_id)).length,
      couple: me.role === "couple" ? (coupleStats.get(w.id) ?? null) : null,
    });
  }
  // soonest wedding first, undated last
  return out.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.name.localeCompare(b.name));
}
