import { createAdminClient } from "@/lib/supabase/admin";

// The people shown in the group chart under the Groomsmen / Bridesmaids
// headers: the groom (or bride), the best man (or maid of honour), and
// everyone tagged to that group. Names and roles only, nothing private. Read
// with the server's own access because a best man cannot ordinarily read other
// people's contact rows, and the page this appears on is already restricted to
// people who belong on that board.

export type GroupKind = "groomsman" | "bridesmaid";

export type GroupMember = { id: string; name: string; first: string; photo: string | null };
export type GroupChartData = {
  head: GroupMember | null; // groom or bride
  lead: GroupMember[]; // best man / maid of honour
  members: GroupMember[]; // groomsmen / bridesmaids
};

// Which half of the couple heads each group. Matched by first name.
const HEAD_FIRST_NAME: Record<GroupKind, string> = { groomsman: "nick", bridesmaid: "ellie" };
const LEAD_TAG: Record<GroupKind, string> = { groomsman: "best_man", bridesmaid: "maid_of_honour" };

function toMember(c: { id: string; full_name: string; photo_url?: string | null }): GroupMember {
  const name = c.full_name.trim();
  return { id: c.id, name, first: name.split(/\s+/)[0] ?? name, photo: c.photo_url ?? null };
}

export async function loadGroupChart(kind: GroupKind): Promise<GroupChartData> {
  const admin = createAdminClient();
  const query = (cols: string) =>
    admin
      .from("contacts")
      .select(cols)
      .is("parent_contact_id", null)
      .or(`role.eq.couple,tags.cs.{${kind}},tags.cs.{${LEAD_TAG[kind]}}`)
      .order("full_name");
  // With photos once migration 0045 has been run; without them until then.
  let res = await query("id, full_name, role, tags, photo_url");
  if (res.error) res = await query("id, full_name, role, tags");
  const data = (res.data ?? []) as unknown as { id: string; full_name: string; role: string; tags: string[] | null; photo_url?: string | null }[];

  const rows = data ?? [];
  const lead = rows.filter((r) => r.role !== "couple" && (r.tags ?? []).includes(LEAD_TAG[kind])).map(toMember);
  const leadIds = new Set(lead.map((l) => l.id));
  const members = rows
    .filter((r) => r.role !== "couple" && (r.tags ?? []).includes(kind) && !leadIds.has(r.id))
    .map(toMember);
  const headRow = rows.find((r) => r.role === "couple" && r.full_name.trim().toLowerCase().startsWith(HEAD_FIRST_NAME[kind]));
  return { head: headRow ? toMember(headRow) : null, lead, members };
}
