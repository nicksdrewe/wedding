import { createAdminClient } from "@/lib/supabase/admin";

// The people shown in the group chart under the Groomsmen / Bridesmaids
// headers: the groom (or bride), the best man (or maid of honour), and
// everyone tagged to that group. Names and roles only, nothing private. Read
// with the server's own access because a best man cannot ordinarily read other
// people's contact rows, and the page this appears on is already restricted to
// people who belong on that board.

export type GroupKind = "groomsman" | "bridesmaid";

export type GroupMember = { id: string; name: string; first: string };
export type GroupChartData = {
  head: GroupMember | null; // groom or bride
  lead: GroupMember[]; // best man / maid of honour
  members: GroupMember[]; // groomsmen / bridesmaids
};

// Which half of the couple heads each group. Matched by first name.
const HEAD_FIRST_NAME: Record<GroupKind, string> = { groomsman: "nick", bridesmaid: "ellie" };
const LEAD_TAG: Record<GroupKind, string> = { groomsman: "best_man", bridesmaid: "maid_of_honour" };

function toMember(c: { id: string; full_name: string }): GroupMember {
  const name = c.full_name.trim();
  return { id: c.id, name, first: name.split(/\s+/)[0] ?? name };
}

export async function loadGroupChart(kind: GroupKind): Promise<GroupChartData> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("contacts")
    .select("id, full_name, role, tags")
    .is("parent_contact_id", null)
    .or(`role.eq.couple,tags.cs.{${kind}},tags.cs.{${LEAD_TAG[kind]}}`)
    .order("full_name");

  const rows = data ?? [];
  const lead = rows.filter((r) => r.role !== "couple" && (r.tags ?? []).includes(LEAD_TAG[kind])).map(toMember);
  const leadIds = new Set(lead.map((l) => l.id));
  const members = rows
    .filter((r) => r.role !== "couple" && (r.tags ?? []).includes(kind) && !leadIds.has(r.id))
    .map(toMember);
  const headRow = rows.find((r) => r.role === "couple" && r.full_name.trim().toLowerCase().startsWith(HEAD_FIRST_NAME[kind]));
  return { head: headRow ? toMember(headRow) : null, lead, members };
}
