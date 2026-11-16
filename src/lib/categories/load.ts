import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/auth/role-types";
import { normalizeTags } from "@/lib/tags";
import { getFxRates } from "@/lib/currency/rates";
import { convertToGBP, type Currency } from "@/lib/currency/convert";
import { computeOptionTotals, type CostItem } from "@/lib/options/totals";
import { readOptionCosts } from "@/lib/options/costs";
import { coverImageOf } from "@/lib/options/cover";
import { categoryKeyChain, resolvePermission, type ResolvedPermission } from "@/lib/permissions/resolve";
import { fetchCategoryRows } from "./rows";
import type { BoardKey } from "./boards";
import { buildCategoryTree, type CategoryInput, type CategoryNode } from "./tree";

// Server-only: loads every category this person can see, with its options'
// figures, and returns the tree with costs rolled up (see ./tree.ts). One set
// of queries for the whole tree, whatever its size.
//
// What the viewer may see is decided by the database (the queries run as
// them): a category they can't open isn't returned, and an option's prices
// they can't see come back empty. The access rules are resolved once here for
// every category so pages don't ask one at a time.

export type CategoryTree = {
  roots: CategoryNode[];
  permissions: Map<string, ResolvedPermission>; // by category id
};

type CostEmbed = {
  predicted_cost_min: number | null;
  predicted_cost_max: number | null;
  actual_cost: number | null;
  currency: Currency | null;
};

// board = null loads the main wedding's categories; 'groomsman' / 'bridesmaid'
// loads that stag or hen board's own tree (0047_board_categories.sql).
export async function loadCategoryTree(profile: Profile | null, board: BoardKey | null = null): Promise<CategoryTree> {
  const supabase = await createClient();
  const [{ data: cats }, { data: groups }, rates] = await Promise.all([
    supabase
      .from("category_pages")
      .select("id, slug, title, parent_id, sort_order, category_costs(predicted_cost_min, predicted_cost_max, actual_cost, currency)")
      .order("title"),
    supabase
      .from("option_groups")
      .select(
        "id, category_page_id, page_options(id, name, is_winner, latitude, longitude, page_option_images(image_url, sort_order), page_option_costs(predicted_cost_min, predicted_cost_max, actual_cost, currency), option_cost_items(amount, kind))"
      )
      .not("category_page_id", "is", null),
    getFxRates(),
  ]);

  // Which board each category is on (own query so a missing column never breaks the tree).
  const allRows = await fetchCategoryRows(supabase);
  const boardById = new Map(allRows.map((r) => [r.id, r.board_tag]));
  const categories = (cats ?? []).filter((c) => (boardById.get(c.id) ?? null) === board);
  // Kinds come from their own small query so a missing column never breaks the tree.
  const { data: kindRows } = await supabase.from("category_pages").select("id, option_kind");
  // Category pins (0048) come from their own small query for the same reason.
  const { data: locRows } = await supabase.from("category_pages").select("id, latitude, longitude");
  const locById = new Map((locRows ?? []).map((r) => [r.id, r as { latitude?: number | null; longitude?: number | null }]));
  const { data: fbRows } = await supabase.from("category_pages").select("id, feedback_enabled");
  const fbById = new Map((fbRows ?? []).map((r) => [r.id, (r as { feedback_enabled?: boolean }).feedback_enabled]));
  const kindById = new Map((kindRows ?? []).map((r) => [r.id, (r as { option_kind?: string | null }).option_kind ?? null]));

  // Access rules for every category at once.
  const permissions = new Map<string, ResolvedPermission>();
  if (profile && profile.role !== "couple") {
    const admin = createAdminClient();
    const [allCats, { data: rules }, contact] = await Promise.all([
      // The full chain, including parents this person can't see themselves.
      fetchCategoryRows(admin),
      admin
        .from("page_permissions")
        .select("page_key, principal_type, principal_value, page_access, data_access, edit_access, cost_access"),
      profile.contact_id
        ? admin.from("contacts").select("tags").eq("id", profile.contact_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const tags = normalizeTags((contact.data as { tags?: string[] | null } | null)?.tags);
    for (const c of categories) {
      permissions.set(c.id, resolvePermission(categoryKeyChain(c.slug, allCats), rules ?? [], profile.role, tags));
    }
  } else {
    const all = profile?.role === "couple";
    for (const c of categories) {
      permissions.set(c.id, { pageAccess: all, dataAccess: all, editAccess: all, costAccess: all });
    }
  }

  const optionsByCategory = new Map<string, CategoryInput["options"]>();
  for (const g of groups ?? []) {
    if (!g.category_page_id) continue;
    const raw = Array.isArray(g.page_options) ? g.page_options : g.page_options ? [g.page_options] : [];
    const list = optionsByCategory.get(g.category_page_id) ?? [];
    for (const o of raw) {
      const costs = readOptionCosts(o);
      const items = ((o.option_cost_items ?? []) as { amount: number | string; kind: "cost" | "income" }[]).map(
        (i): CostItem => ({ amount: Number(i.amount), kind: i.kind })
      );
      const totals = costs.costs_hidden
        ? null
        : computeOptionTotals(
            {
              predicted_cost_min: costs.predicted_cost_min == null ? null : Number(costs.predicted_cost_min),
              predicted_cost_max: costs.predicted_cost_max == null ? null : Number(costs.predicted_cost_max),
              actual_cost: costs.actual_cost == null ? null : Number(costs.actual_cost),
            },
            items
          );
      const gbp = (n: number | null) => (n == null ? null : convertToGBP(n, costs.currency, rates));
      list.push({
        id: o.id,
        name: o.name,
        isWinner: !!o.is_winner,
        min: gbp(totals?.totalMin ?? null),
        max: gbp(totals?.totalMax ?? null),
        actual: gbp(totals?.totalActual ?? null),
        costsHidden: costs.costs_hidden,
        latitude: o.latitude ?? null,
        longitude: o.longitude ?? null,
        coverImageUrl: coverImageOf(o),
      });
    }
    optionsByCategory.set(g.category_page_id, list);
  }

  const inputs: CategoryInput[] = categories.map((c) => {
    const rawCost = (Array.isArray(c.category_costs) ? c.category_costs[0] : c.category_costs) as CostEmbed | null | undefined;
    const currency: Currency = rawCost?.currency ?? "GBP";
    const num = (v: number | null | undefined) => (v == null ? null : convertToGBP(Number(v), currency, rates));
    const lMin = num(rawCost?.predicted_cost_min);
    const lMax = num(rawCost?.predicted_cost_max);
    const lActual = num(rawCost?.actual_cost);
    const lo = lMin ?? lMax ?? lActual;
    const hi = lMax ?? lMin ?? lActual;
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      parentId: c.parent_id,
      sortOrder: c.sort_order ?? 0,
      optionKind: kindById.get(c.id) ?? null,
      feedbackEnabled: fbById.get(c.id) !== false,
      latitude: locById.get(c.id)?.latitude ?? null,
      longitude: locById.get(c.id)?.longitude ?? null,
      costAccess: permissions.get(c.id)?.costAccess ?? false,
      options: optionsByCategory.get(c.id) ?? [],
      legacy: lo != null && hi != null ? { min: lo, max: hi, actual: lActual } : null,
    };
  });

  return { roots: buildCategoryTree(inputs), permissions };
}
