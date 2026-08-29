"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase.from("category_pages").insert({ title, slug });

  revalidatePath("/categories");
  return { error: error?.message ?? null };
}

const costSchema = z.object({
  categoryPageId: z.string().uuid(),
  predictedCost: z.coerce.number().nonnegative().optional().nullable(),
  actualCost: z.coerce.number().nonnegative().optional().nullable(),
});

export async function updateCategoryCost(formData: FormData) {
  const parsed = costSchema.parse({
    categoryPageId: formData.get("categoryPageId"),
    predictedCost: formData.get("predictedCost") || null,
    actualCost: formData.get("actualCost") || null,
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
          predicted_cost: parsed.predictedCost,
          actual_cost: parsed.actualCost,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
    : await supabase.from("category_costs").insert({
        category_page_id: parsed.categoryPageId,
        predicted_cost: parsed.predictedCost,
        actual_cost: parsed.actualCost,
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
