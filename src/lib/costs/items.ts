"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Amount is always the persisted, authoritative figure — when quantity and
// rate are both given, this computes it server-side (never trusts a
// client-computed value), so amount can never silently drift from
// quantity * rate.
function resolveAmount(quantity: number | null, rate: number | null, amount: number | null): number {
  if (quantity != null && rate != null) return quantity * rate;
  return amount ?? 0;
}

const addSchema = z.object({
  pageOptionId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  kind: z.enum(["cost", "income"]),
  quantity: z.coerce.number().nonnegative().optional().nullable(),
  rate: z.coerce.number().nonnegative().optional().nullable(),
  amount: z.coerce.number().nonnegative().optional().nullable(),
  revalidate: z.string(),
});

export async function addCostItem(formData: FormData) {
  const parsed = addSchema.parse({
    pageOptionId: formData.get("pageOptionId"),
    name: formData.get("name"),
    kind: formData.get("kind"),
    quantity: formData.get("quantity") || null,
    rate: formData.get("rate") || null,
    amount: formData.get("amount") || null,
    revalidate: formData.get("revalidate"),
  });

  const amount = resolveAmount(parsed.quantity ?? null, parsed.rate ?? null, parsed.amount ?? null);

  const supabase = await createClient();
  const { error } = await supabase.from("option_cost_items").insert({
    page_option_id: parsed.pageOptionId,
    name: parsed.name,
    kind: parsed.kind,
    quantity: parsed.quantity ?? null,
    rate: parsed.rate ?? null,
    amount,
  });

  revalidatePath(parsed.revalidate);
  revalidatePath("/categories");
  revalidatePath("/budget");
  revalidatePath("/project");
  return { error: error?.message ?? null };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  kind: z.enum(["cost", "income"]),
  quantity: z.coerce.number().nonnegative().optional().nullable(),
  rate: z.coerce.number().nonnegative().optional().nullable(),
  amount: z.coerce.number().nonnegative().optional().nullable(),
  revalidate: z.string(),
});

export async function updateCostItem(formData: FormData) {
  const parsed = updateSchema.parse({
    id: formData.get("id"),
    name: formData.get("name"),
    kind: formData.get("kind"),
    quantity: formData.get("quantity") || null,
    rate: formData.get("rate") || null,
    amount: formData.get("amount") || null,
    revalidate: formData.get("revalidate"),
  });

  const amount = resolveAmount(parsed.quantity ?? null, parsed.rate ?? null, parsed.amount ?? null);

  const supabase = await createClient();
  const { error } = await supabase
    .from("option_cost_items")
    .update({
      name: parsed.name,
      kind: parsed.kind,
      quantity: parsed.quantity ?? null,
      rate: parsed.rate ?? null,
      amount,
    })
    .eq("id", parsed.id);

  revalidatePath(parsed.revalidate);
  revalidatePath("/categories");
  revalidatePath("/budget");
  revalidatePath("/project");
  return { error: error?.message ?? null };
}

export async function deleteCostItem(id: string, revalidate: string) {
  const parsed = z.string().uuid().parse(id);
  const supabase = await createClient();
  const { error } = await supabase.from("option_cost_items").delete().eq("id", parsed);

  revalidatePath(revalidate);
  revalidatePath("/categories");
  revalidatePath("/budget");
  revalidatePath("/project");
  return { error: error?.message ?? null };
}
