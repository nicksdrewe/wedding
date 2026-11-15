"use server";

// A stag/hen project's own budget lines (project_budget_items — see
// 0034_project_admins_and_budgets.sql). Kept apart from the wedding's
// category costs on purpose: nothing written here can reach the wedding
// Budget page. RLS is the real gate (project admin + allowed to see the
// project's money); these actions only validate input and report refusals.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";

const visibleTagSchema = z.enum(["bridesmaid", "groomsman"]);

function pathForTag(tag: z.infer<typeof visibleTagSchema>) {
  return tag === "bridesmaid" ? "/project/bridesmaids" : "/project/groomsmen";
}

const fieldsSchema = z.object({
  visibleTag: visibleTagSchema,
  name: z.string().trim().min(1, "Give the line a name.").max(200),
  predictedCost: z.coerce.number().nonnegative("Costs can't be negative.").nullable(),
  actualCost: z.coerce.number().nonnegative("Costs can't be negative.").nullable(),
  currency: z.enum(["GBP", "EUR"]),
});

function readFields(formData: FormData) {
  return fieldsSchema.safeParse({
    visibleTag: formData.get("visibleTag"),
    name: formData.get("name"),
    predictedCost: formData.get("predictedCost") || null,
    actualCost: formData.get("actualCost") || null,
    currency: formData.get("currency") || "GBP",
  });
}

const REFUSED = "That wasn't saved — only the project's admin can change its budget.";

export async function addProjectBudgetItem(formData: FormData) {
  const parsed = readFields(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields and try again." };

  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("project_budget_items").insert({
    visible_tag: parsed.data.visibleTag,
    name: parsed.data.name,
    predicted_cost: parsed.data.predictedCost,
    actual_cost: parsed.data.actualCost,
    currency: parsed.data.currency,
    created_by: profile?.id ?? null,
  });

  revalidatePath(pathForTag(parsed.data.visibleTag));
  // An RLS refusal on insert surfaces as an error from Postgres; give it the
  // plain-language version rather than the raw policy message.
  return { error: error ? REFUSED : null };
}

export async function updateProjectBudgetItem(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  const parsed = readFields(formData);
  if (!id.success) return { error: "That budget line couldn't be found." };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields and try again." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_budget_items")
    .update({
      name: parsed.data.name,
      predicted_cost: parsed.data.predictedCost,
      actual_cost: parsed.data.actualCost,
      currency: parsed.data.currency,
    })
    .eq("id", id.data)
    .select("id");

  revalidatePath(pathForTag(parsed.data.visibleTag));
  if (error) return { error: error.message };
  // RLS refuses an update silently (zero rows) rather than with an error.
  if (!data || data.length === 0) return { error: REFUSED };
  return { error: null };
}

export async function deleteProjectBudgetItem(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "That budget line couldn't be found." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_budget_items")
    .delete()
    .eq("id", parsed.data)
    .select("id, visible_tag");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: REFUSED };
  revalidatePath(pathForTag(data[0].visible_tag));
  return { error: null };
}
