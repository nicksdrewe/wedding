"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, RoleTier } from "@/lib/auth/role-types";
import { normalizeTag, normalizeTags, ROLE_TAG_VALUES } from "@/lib/tags";

export type PageRegistryRow = {
  page_key: string;
  parent_page_key: string | null;
  label: string;
  is_dynamic: boolean;
  default_min_role: RoleTier | null;
};

export type PagePermissionRow = {
  id: string;
  page_key: string;
  principal_type: "role" | "tag";
  principal_value: string;
  page_access: boolean;
  data_access: boolean;
  edit_access: boolean;
  cost_access: boolean;
};

export async function listPageRegistry(): Promise<PageRegistryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("page_registry")
    .select("page_key, parent_page_key, label, is_dynamic, default_min_role")
    .order("page_key");
  return data ?? [];
}

export async function listPagePermissions(): Promise<PagePermissionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("page_permissions")
    .select("id, page_key, principal_type, principal_value, page_access, data_access, edit_access, cost_access")
    .order("page_key");
  return data ?? [];
}

export async function listKnownTags(): Promise<string[]> {
  // No RPC exists for "distinct unnest" over an array column — the couple
  // -only admin page this feeds already reads the full contacts list
  // elsewhere, so a plain select + client-side dedupe here is simpler than
  // adding a database function just for an autocomplete list.
  const supabase = await createClient();
  const { data } = await supabase.from("contacts").select("tags");
  // Normalised, and always including the four access-bearing role tags even
  // if nobody currently holds them, so the couple can set a rule ahead of
  // tagging anyone.
  const set = new Set<string>(ROLE_TAG_VALUES);
  for (const row of data ?? []) for (const tag of normalizeTags(row.tags)) set.add(tag);
  return [...set].sort((a, b) => a.localeCompare(b));
}

const upsertSchema = z.object({
  pageKey: z.string().min(1),
  principalType: z.enum(["role", "tag"]),
  principalValue: z.string().min(1),
  pageAccess: z.boolean(),
  dataAccess: z.boolean(),
  editAccess: z.boolean(),
  costAccess: z.boolean(),
});

export async function upsertPagePermission(formData: FormData) {
  const parsed = upsertSchema.parse({
    pageKey: formData.get("pageKey"),
    principalType: formData.get("principalType"),
    principalValue: formData.get("principalValue"),
    pageAccess: formData.get("pageAccess") === "on",
    dataAccess: formData.get("dataAccess") === "on",
    editAccess: formData.get("editAccess") === "on",
    costAccess: formData.get("costAccess") === "on",
  });

  const supabase = await createClient();
  const { error } = await supabase.from("page_permissions").upsert(
    {
      page_key: parsed.pageKey,
      principal_type: parsed.principalType,
      // Tag rows are matched by exact string against normalised contact
      // tags (see lib/tags.ts), so a hand-typed "Best Man" here would
      // silently never match anyone.
      principal_value:
        parsed.principalType === "tag" ? normalizeTag(parsed.principalValue) : parsed.principalValue,
      page_access: parsed.pageAccess,
      data_access: parsed.dataAccess,
      edit_access: parsed.editAccess,
      cost_access: parsed.costAccess,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "page_key,principal_type,principal_value" }
  );

  revalidatePath("/access");
  return { error: error?.message ?? null };
}

export async function deletePagePermission(id: string) {
  const parsed = z.string().uuid().parse(id);
  const supabase = await createClient();
  const { error } = await supabase.from("page_permissions").delete().eq("id", parsed);

  revalidatePath("/access");
  return { error: error?.message ?? null };
}

export type EffectivePermission = {
  pageAccess: boolean;
  dataAccess: boolean;
  editAccess: boolean;
  // May see (and, where they can edit, change) prices on this page — see
  // 0031_cost_access.sql. This return value only drives what the UI offers;
  // the prices themselves are withheld by RLS via fn_resolve_cost_access,
  // which this mirrors rule-for-rule.
  costAccess: boolean;
};

// Mirrors fn_resolve_data_access (0025_page_permissions.sql) in JS, for the
// page_access axis — which is deliberately NOT RLS-enforced (it's a
// navigation concern; the underlying rows are separately protected by
// data_access/RLS regardless of whether a route also gates on this). Kept
// as one shared resolver rather than duplicated per route guard. Uses the
// admin client for the lookup itself (permissions metadata isn't sensitive
// and every caller of this already has a resolved profile), so a
// non-couple viewer's own RLS-restricted read of page_permissions doesn't
// short the resolver even though only the couple can normally read that
// table full-scope — this function is the one place allowed to peek on
// everyone's behalf, since it's answering "what CAN this profile see",
// not showing them the raw permissions table.
export async function getEffectivePermission(pageKey: string, profile: Profile | null): Promise<EffectivePermission> {
  if (!profile) return { pageAccess: false, dataAccess: false, editAccess: false, costAccess: false };
  if (profile.role === "couple") return { pageAccess: true, dataAccess: true, editAccess: true, costAccess: true };

  const supabase = createAdminClient();

  let tags: string[] = [];
  if (profile.contact_id) {
    const { data: contact } = await supabase.from("contacts").select("tags").eq("id", profile.contact_id).maybeSingle();
    tags = normalizeTags(contact?.tags);
  }

  const { data: registryRow } = await supabase
    .from("page_registry")
    .select("page_key, parent_page_key")
    .eq("page_key", pageKey)
    .maybeSingle();

  // Same parent fallback as fn_resolve_cost_access: a category/project
  // sub-page with no registry row still inherits its parent's rules.
  const parentKey =
    registryRow?.parent_page_key ??
    (pageKey.startsWith("categories:") ? "categories" : pageKey.startsWith("project:") ? "project" : null);
  const keysToTry = [pageKey, parentKey].filter((k): k is string => !!k);

  for (const key of keysToTry) {
    const { data: rows } = await supabase
      .from("page_permissions")
      .select("principal_type, principal_value, page_access, data_access, edit_access, cost_access")
      .eq("page_key", key);
    if (!rows || rows.length === 0) continue;

    const tagRows = rows.filter((r) => r.principal_type === "tag" && tags.includes(normalizeTag(r.principal_value)));
    if (tagRows.length > 0) {
      return {
        pageAccess: !tagRows.some((r) => !r.page_access),
        dataAccess: !tagRows.some((r) => !r.data_access),
        editAccess: !tagRows.some((r) => !r.edit_access),
        costAccess: !tagRows.some((r) => !r.cost_access),
      };
    }

    const roleRow = rows.find((r) => r.principal_type === "role" && r.principal_value === profile.role);
    if (roleRow) {
      return {
        pageAccess: roleRow.page_access,
        dataAccess: roleRow.data_access,
        editAccess: roleRow.edit_access,
        costAccess: roleRow.cost_access,
      };
    }
  }

  // No rule at all: everything else keeps its long-standing "allowed"
  // default, but prices fall back to the pre-existing baseline only (family),
  // never to wedding party or guests.
  return { pageAccess: true, dataAccess: true, editAccess: true, costAccess: profile.role === "family" };
}
