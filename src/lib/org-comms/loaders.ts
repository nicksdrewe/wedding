import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COMM_ROW_COLUMNS, type CommCategory, type CommOption, type OrgComm } from "./types";

type Row = Omit<OrgComm, "author_name" | "category_title" | "option_name">;

// Categories and options the viewer can see (RLS filters both) — used for the
// "About" pickers and to name the chips on each entry.
export async function loadCommTargets(
  supabase: SupabaseClient
): Promise<{ categories: CommCategory[]; options: CommOption[] }> {
  const [{ data: cats }, { data: opts }] = await Promise.all([
    supabase.from("category_pages").select("id, title, parent_id").order("title"),
    supabase.from("page_options").select("id, name, option_groups(title, category_page_id)").order("name"),
  ]);

  const categories: CommCategory[] = (cats ?? []).map((c) => ({
    id: c.id as string,
    title: c.title as string,
    parent_id: (c.parent_id as string | null) ?? null,
  }));

  const options: CommOption[] = (opts ?? []).map((o) => {
    const g = Array.isArray(o.option_groups) ? o.option_groups[0] : o.option_groups;
    return {
      id: o.id as string,
      name: o.name as string,
      groupTitle: (g?.title as string | undefined) ?? null,
      categoryId: (g?.category_page_id as string | undefined) ?? null,
    };
  });

  return { categories, options };
}

// Latest 200 entries (newest first), optionally narrowed to an option or a
// category (and its sub-categories). An entry named by `ensureId` is always
// included so a link from the diary can find it.
export async function loadOrgComms(
  supabase: SupabaseClient,
  opts: {
    optionId?: string | null;
    categoryIds?: string[] | null;
    ensureId?: string | null;
    categories: CommCategory[];
    options: CommOption[];
  }
): Promise<OrgComm[]> {
  let q = supabase
    .from("org_comms")
    .select(COMM_ROW_COLUMNS)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (opts.optionId) q = q.eq("page_option_id", opts.optionId);
  else if (opts.categoryIds && opts.categoryIds.length > 0) q = q.in("category_page_id", opts.categoryIds);

  const { data, error } = await q;
  if (error) return [];
  let rows = (data ?? []) as Row[];

  if (opts.ensureId && !rows.some((r) => r.id === opts.ensureId)) {
    const { data: one } = await supabase.from("org_comms").select(COMM_ROW_COLUMNS).eq("id", opts.ensureId).maybeSingle();
    if (one) rows = [...rows, one as Row].sort((a, b) => (a.occurred_on < b.occurred_on ? 1 : -1));
  }

  // Author names: a separate lookup so a profiles policy can never break the list.
  const authorIds = [...new Set(rows.map((r) => r.created_by))];
  const names = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: people } = await supabase.from("profiles").select("id, full_name").in("id", authorIds);
    for (const p of people ?? []) if (p.full_name) names.set(p.id as string, p.full_name as string);
  }
  const catTitle = new Map(opts.categories.map((c) => [c.id, c.title]));
  const optName = new Map(opts.options.map((o) => [o.id, o.name]));

  return rows.map((r) => ({
    ...r,
    author_name: names.get(r.created_by) ?? null,
    category_title: r.category_page_id ? (catTitle.get(r.category_page_id) ?? null) : null,
    option_name: r.page_option_id ? (optName.get(r.page_option_id) ?? null) : null,
  }));
}
