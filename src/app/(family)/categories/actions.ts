"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";

function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createCategoryPage(formData: FormData) {
  const title = z.string().min(1).parse(formData.get("title"));
  const supabase = await createClient();

  // slug has a unique constraint (0001_init.sql) — two titles that
  // normalise to the same slug ("Venue" / "venue ") previously failed this
  // insert silently (the error was never checked), so the page looked like
  // it did nothing while an earlier, differently-titled category with the
  // same slug sat there unexplained. Dedupe against existing slugs instead
  // of just hoping for the best.
  const base = slugify(title);
  const { data: clashes } = await supabase
    .from("category_pages")
    .select("slug")
    .like("slug", `${base}%`);

  const taken = new Set((clashes ?? []).map((c) => c.slug));
  let slug = base;
  let n = 2;
  while (taken.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }

  const { data: page, error } = await supabase
    .from("category_pages")
    .insert({ title, slug })
    .select("id")
    .single();

  if (error) {
    revalidatePath("/categories");
    return { error: error.message };
  }

  // So this category has an access-control entry (see
  // 0025_page_permissions.sql) from the moment it exists — not fatal if it
  // fails, since fn_resolve_data_access/getEffectivePermission both default
  // to "allowed" for a page_key with no registry row at all.
  await supabase
    .from("page_registry")
    .insert({ page_key: `categories:${slug}`, parent_page_key: "categories", label: title, default_min_role: "family" });

  // Every category gets its options board from the moment it exists —
  // there's no real reason for a category to ever NOT have one (see
  // migration 0007, which backfills this for categories created before
  // this existed). Not fatal if this fails: the category itself was
  // created fine, and the category page falls back to a manual "Start
  // Options Mode" button for the rare case this is missing.
  const profile = await getCurrentProfile();
  await supabase
    .from("option_groups")
    .insert({ category_page_id: page.id, title, created_by: profile?.id ?? null });

  revalidatePath("/categories");
  return { error: null };
}

const updateCategoryPageSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
});

export async function updateCategoryPage(formData: FormData) {
  const parsed = updateCategoryPageSchema.parse({
    id: formData.get("id"),
    title: formData.get("title"),
  });

  const supabase = await createClient();
  // Slug is left untouched on edit (unlike create's dedupe dance) so the
  // category's URL — and anything already linking to it — keeps working.
  const { error } = await supabase
    .from("category_pages")
    .update({ title: parsed.title })
    .eq("id", parsed.id);

  revalidatePath("/categories");
  return { error: error?.message ?? null };
}

export async function deleteCategoryPage(id: string) {
  const parsed = z.string().uuid().parse(id);
  const supabase = await createClient();

  // Cascades (0001/0004): page_options (via option_groups), category_costs,
  // category_contacts, diary_entries, and the option_groups row itself all
  // go with it — the caller's confirm copy must say so explicitly.
  const { error } = await supabase.from("category_pages").delete().eq("id", parsed);

  revalidatePath("/categories");
  revalidatePath("/budget");
  revalidatePath("/diary");
  revalidatePath("/project");
  return { error: error?.message ?? null };
}

const costSchema = z
  .object({
    categoryPageId: z.string().uuid(),
    predictedCostMin: z.coerce.number().nonnegative().optional().nullable(),
    predictedCostMax: z.coerce.number().nonnegative().optional().nullable(),
    actualCost: z.coerce.number().nonnegative().optional().nullable(),
    currency: z.enum(["GBP", "EUR"]),
  })
  .refine(
    (v) => v.predictedCostMin == null || v.predictedCostMax == null || v.predictedCostMin <= v.predictedCostMax,
    { message: "Minimum predicted cost can't be higher than the maximum.", path: ["predictedCostMax"] }
  );

export async function updateCategoryCost(formData: FormData) {
  const parsed = costSchema.parse({
    categoryPageId: formData.get("categoryPageId"),
    predictedCostMin: formData.get("predictedCostMin") || null,
    predictedCostMax: formData.get("predictedCostMax") || null,
    actualCost: formData.get("actualCost") || null,
    currency: formData.get("currency") || "GBP",
  });

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("category_costs")
    .select("id")
    .eq("category_page_id", parsed.categoryPageId)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("category_costs")
        .update({
          predicted_cost_min: parsed.predictedCostMin,
          predicted_cost_max: parsed.predictedCostMax,
          actual_cost: parsed.actualCost,
          currency: parsed.currency,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
    : await supabase.from("category_costs").insert({
        category_page_id: parsed.categoryPageId,
        predicted_cost_min: parsed.predictedCostMin,
        predicted_cost_max: parsed.predictedCostMax,
        actual_cost: parsed.actualCost,
        currency: parsed.currency,
      });

  revalidatePath("/categories");
  revalidatePath("/budget");
  return { error: error?.message ?? null };
}

const contactSchema = z.object({
  categoryPageId: z.string().uuid(),
  name: z.string().min(1),
  role: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export async function addCategoryContact(formData: FormData) {
  const parsed = contactSchema.parse({
    categoryPageId: formData.get("categoryPageId"),
    name: formData.get("name"),
    role: formData.get("role") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || "",
  });

  const supabase = await createClient();
  const { error } = await supabase.from("category_contacts").insert({
    category_page_id: parsed.categoryPageId,
    name: parsed.name,
    role: parsed.role ?? null,
    phone: parsed.phone ?? null,
    email: parsed.email || null,
  });

  revalidatePath("/categories");
  return { error: error?.message ?? null };
}

const updateContactSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  role: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export async function updateCategoryContact(formData: FormData) {
  const parsed = updateContactSchema.parse({
    id: formData.get("id"),
    name: formData.get("name"),
    role: formData.get("role") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || "",
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("category_contacts")
    .update({
      name: parsed.name,
      role: parsed.role ?? null,
      phone: parsed.phone ?? null,
      email: parsed.email || null,
    })
    .eq("id", parsed.id);

  revalidatePath("/categories");
  return { error: error?.message ?? null };
}

export async function deleteCategoryContact(id: string) {
  const parsed = z.string().uuid().parse(id);
  const supabase = await createClient();

  const { error } = await supabase.from("category_contacts").delete().eq("id", parsed);

  revalidatePath("/categories");
  return { error: error?.message ?? null };
}

const dateSchema = z.object({
  categoryPageId: z.string().uuid(),
  title: z.string().min(1),
  entryDate: z.string().min(1),
});

export async function addCategoryDate(formData: FormData) {
  const parsed = dateSchema.parse({
    categoryPageId: formData.get("categoryPageId"),
    title: formData.get("title"),
    entryDate: formData.get("entryDate"),
  });

  const supabase = await createClient();
  const { error } = await supabase.from("diary_entries").insert({
    title: parsed.title,
    entry_date: parsed.entryDate,
    source: "category_page",
    category_page_id: parsed.categoryPageId,
  });

  revalidatePath("/categories");
  revalidatePath("/diary");
  return { error: error?.message ?? null };
}

const updateDateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  entryDate: z.string().min(1),
});

export async function updateCategoryDate(formData: FormData) {
  const parsed = updateDateSchema.parse({
    id: formData.get("id"),
    title: formData.get("title"),
    entryDate: formData.get("entryDate"),
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("diary_entries")
    .update({ title: parsed.title, entry_date: parsed.entryDate })
    .eq("id", parsed.id);

  revalidatePath("/categories");
  revalidatePath("/diary");
  return { error: error?.message ?? null };
}

export async function deleteCategoryDate(id: string) {
  const parsed = z.string().uuid().parse(id);
  const supabase = await createClient();

  const { error } = await supabase.from("diary_entries").delete().eq("id", parsed);

  revalidatePath("/categories");
  revalidatePath("/diary");
  return { error: error?.message ?? null };
}
