import type { RoleTier } from "@/lib/auth/role-types";
import { normalizeTag } from "@/lib/tags";

// The one in-memory rule resolver, mirroring fn_resolve_permission /
// fn_resolve_cost_access (0042_nested_categories.sql): walk the page and then
// each of its parents; at the first page with a matching rule, a tag rule
// beats a role rule, and among several matching tags a "no" wins. No rule
// anywhere = allowed, except prices, which fall back to family only.
// Pure — callers fetch the rows.

export type PermissionRuleRow = {
  page_key: string;
  principal_type: "role" | "tag" | string;
  principal_value: string;
  page_access: boolean;
  data_access: boolean;
  edit_access: boolean;
  cost_access: boolean;
};

export type ResolvedPermission = {
  pageAccess: boolean;
  dataAccess: boolean;
  editAccess: boolean;
  costAccess: boolean;
};

export function resolvePermission(
  keyChain: string[],
  rows: PermissionRuleRow[],
  role: RoleTier,
  tags: string[]
): ResolvedPermission {
  if (role === "couple") return { pageAccess: true, dataAccess: true, editAccess: true, costAccess: true };

  for (const key of keyChain) {
    const here = rows.filter((r) => r.page_key === key);
    if (here.length === 0) continue;

    const tagRows = here.filter((r) => r.principal_type === "tag" && tags.includes(normalizeTag(r.principal_value)));
    if (tagRows.length > 0) {
      return {
        pageAccess: !tagRows.some((r) => !r.page_access),
        dataAccess: !tagRows.some((r) => !r.data_access),
        editAccess: !tagRows.some((r) => !r.edit_access),
        costAccess: !tagRows.some((r) => !r.cost_access),
      };
    }
    const roleRow = here.find((r) => r.principal_type === "role" && r.principal_value === role);
    if (roleRow) {
      return {
        pageAccess: roleRow.page_access,
        dataAccess: roleRow.data_access,
        editAccess: roleRow.edit_access,
        costAccess: roleRow.cost_access,
      };
    }
  }
  return { pageAccess: true, dataAccess: true, editAccess: true, costAccess: role === "family" };
}

// The chain of page keys for a category: itself, each parent category, then
// the top-level "categories" page.
export function categoryKeyChain(
  slug: string,
  categories: { id: string; slug: string; parent_id: string | null; board_tag?: string | null }[]
): string[] {
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const byId = new Map(categories.map((c) => [c.id, c]));
  const chain: string[] = [];
  let cursor = bySlug.get(slug);
  if (!cursor) return [`categories:${slug}`, "categories"];
  while (cursor && chain.length < 10) {
    chain.push(`categories:${cursor.slug}`);
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined;
  }
  // A category on a stag/hen board inherits that board's page rules, not the
  // main "categories" page (0047_board_categories.sql).
  const boardTag = categories.find((c) => c.slug === slug)?.board_tag ?? null;
  chain.push(boardTag === "groomsman" ? "project:groomsmen" : boardTag === "bridesmaid" ? "project:bridesmaids" : "categories");
  if (boardTag) chain.push("project");
  return chain;
}
