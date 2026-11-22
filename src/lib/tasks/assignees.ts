import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeTags } from "@/lib/tags";

// Who a task can be given to. Row security only lets someone read their own
// guest-list entry, so a groomsman could never pick the best man. This reads
// names (never anything else) with the server's own access, for pages the
// viewer has already been let into.
//   * the main planning page: the couple, the wedding party and family;
//   * a stag/hen board: the couple, that board's own people, and the best man
//     and maid of honour.
export async function loadAssignees(visibleTag: "groomsman" | "bridesmaid" | null): Promise<{ data: { id: string; full_name: string }[] }> {
  const { data } = await createAdminClient()
    .from("contacts")
    .select("id, full_name, role, tags")
    .in("role", visibleTag ? ["couple", "wedding_party"] : ["couple", "wedding_party", "family"])
    .order("full_name");
  const rows = (data ?? []).filter((c) => {
    if (!visibleTag || c.role === "couple") return true;
    const tags = normalizeTags(c.tags);
    return tags.includes(visibleTag) || tags.includes("best_man") || tags.includes("maid_of_honour");
  });
  return { data: rows.map((c) => ({ id: c.id, full_name: c.full_name })) };
}
