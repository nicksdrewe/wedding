import { createAdminClient } from "@/lib/supabase/admin";
import { getWeddingId } from "@/lib/wedding/current";
import { normalizeTags } from "@/lib/tags";

// The people shown in the group chart under the Groomsmen / Bridesmaids
// headers: the groom (or bride), the best man (or maid of honour), and
// everyone tagged to that group. Names, roles and photos only, nothing
// private. Read with the server's own access because a best man cannot
// ordinarily read other people's contact rows, and the page this appears on is
// already restricted to people who belong on that board.

export type GroupKind = "groomsman" | "bridesmaid";

export type GroupMember = { id: string; name: string; first: string; photo: string | null };
export type GroupChartData = {
  head: GroupMember | null; // groom or bride
  lead: GroupMember[]; // best man / maid of honour
  members: GroupMember[]; // groomsmen / bridesmaids
};

type Row = { id: string; full_name: string; role: string; tags: string[] | null; photo_url?: string | null };

// Which half of the couple heads each group. Matched by first name, with the
// other half of the couple as the fallback so nobody is left off the chart.
const HEAD_FIRST_NAME: Record<GroupKind, string> = { groomsman: "nick", bridesmaid: "ellie" };
const OTHER_FIRST_NAME: Record<GroupKind, string> = { groomsman: "ellie", bridesmaid: "nick" };
const LEAD_TAG: Record<GroupKind, string> = { groomsman: "best_man", bridesmaid: "maid_of_honour" };

function toMember(c: Row): GroupMember {
  const name = c.full_name.trim();
  return { id: c.id, name, first: name.split(/\s+/)[0] ?? name, photo: c.photo_url ?? null };
}

export async function loadGroupChart(kind: GroupKind): Promise<GroupChartData> {
  const weddingId = await getWeddingId();
  const admin = createAdminClient(weddingId);
  // Everyone (not just a filtered few), and the tags compared after
  // normalising them in code: a tag typed as "Bridesmaid" or "bridesmaid "
  // still counts, which a database-side match would silently miss.
  // Plus-ones are included: someone added under another guest can still be tagged into the group.
  const query = (cols: string) => admin.from("contacts").select(cols).eq("wedding_id", weddingId!).order("full_name").limit(2000);
  // With photos once migration 0045 has been run; without them until then.
  let res = await query("id, full_name, role, tags, photo_url");
  if (res.error) res = await query("id, full_name, role, tags");
  const rows = ((res.data ?? []) as unknown as Row[]).filter((r) => r.full_name?.trim());

  const has = (r: Row, tag: string) => normalizeTags(r.tags).includes(tag);
  const people = rows.filter((r) => r.role !== "couple");
  const lead = people.filter((r) => has(r, LEAD_TAG[kind])).map(toMember);
  const leadIds = new Set(lead.map((l) => l.id));
  const members = people.filter((r) => has(r, kind) && !leadIds.has(r.id)).map(toMember);

  const couple = rows.filter((r) => r.role === "couple");
  const startsWith = (r: Row, first: string) => r.full_name.trim().toLowerCase().startsWith(first);
  const headRow =
    couple.find((r) => startsWith(r, HEAD_FIRST_NAME[kind])) ??
    couple.find((r) => !startsWith(r, OTHER_FIRST_NAME[kind]) && couple.length > 1) ??
    null;
  // The couple don't both have to be on the guest list as contacts. If one is
  // missing, the chart still shows them at the top (initials only until they
  // are added as a contact with a photo).
  const first = HEAD_FIRST_NAME[kind];
  // Shown by the name everyone uses ("Ellie"), whatever the full legal name is.
  const display = first.charAt(0).toUpperCase() + first.slice(1);
  const head: GroupMember = headRow
    ? { ...toMember(headRow), first: display }
    : { id: `head-${kind}`, name: first.charAt(0).toUpperCase() + first.slice(1), first: first.charAt(0).toUpperCase() + first.slice(1), photo: null };
  return { head, lead, members };
}
