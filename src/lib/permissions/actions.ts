"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, RoleTier } from "@/lib/auth/role-types";

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
    .select("id, page_key, principal_type, principal_value, page_access, data_access, edit_access")
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
  const set = new Set<string>();
  for (const row of data ?? []) for (const tag of row.tags ?? []) set.add(tag);
  return [...set].sort((a, b) => a.localeCompare(b));
}

const upsertSchema = z.object({
  pageKey: z.string().min(1),
  principalType: z.enum(["role", "tag"]),
  principalValue: z.string().min(1),
  pageAccess: z.boolean(),
  dataAccess: z.boolean(),
  editAccess: z.boolean(),
});

export async function upsertPagePermission(formData: FormData) {
  const parsed = upsertSchema.parse({
    pageKey: formData.get("pageKey"),
    principalType: formData.get("principalType"),
    principalValue: formData.get("principalValue"),
    pageAccess: formData.get("pageAccess") === "on",
    dataAccess: formData.get("dataAccess") === "on",
    editAccess: formData.get("editAccess") === "on",
  });

  const supabase = await createClient();
  const { error } = await supabase.from("page_permissions").upsert(
    {
      page_key: parsed.pageKey,
      principal_type: parsed.principalType,
      principal_value: parsed.principalValue,
      page_access: parsed.pageAccess,
      data_access: parsed.dataAccess,
      edit_access: parsed.editAccess,
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

export type EffectivePermission = { pageAccess: boolean; dataAccess: boolean; editAccess: boolean };

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
  const allow: EffectivePermission = { pageAccess: true, dataAccess: true, editAccess: true };
  if (!profile) return { pageAccess: false, dataAccess: false, editAccess: false };
  if (profile.role === "couple") return allow;

  const supabase = createAdminClient();

  let tags: string[] = [];
  if (profile.contact_id) {
    const { data: contact } = await supabase.from("contacts").select("tags").eq("id", profile.contact_id).maybeSingle();
    tags = contact?.tags ?? [];
  }

  const { data: registryRow } = await supabase
    .from("page_registry")
    .select("page_key, parent_page_key")
    .eq("page_key", pageKey)
    .maybeSingle();

  const keysToTry = [pageKey, registryRow?.parent_page_key].filter((k): k is string => !!k);

  for (const key of keysToTry) {
    const { data: rows } = await supabase
      .from("page_permissions")
      .select("principal_type, principal_value, page_access, data_access, edit_access")
      .eq("page_key", key);
    if (!rows || rows.length === 0) continue;

    const tagRows = rows.filter((r) => r.principal_type === "tag" && tags.includes(r.principal_value));
    if (tagRows.length > 0) {
      return {
        pageAccess: !tagRows.some((r) => !r.page_access),
        dataAccess: !tagRows.some((r) => !r.data_access),
        editAccess: !tagRows.some((r) => !r.edit_access),
      };
    }

    const roleRow = rows.find((r) => r.principal_type === "role" && r.principal_value === profile.role);
    if (roleRow) {
      return { pageAccess: roleRow.page_access, dataAccess: roleRow.data_access, editAccess: roleRow.edit_access };
    }
  }

  return allow;
}
