"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";

// Options mode: the same mechanism drives comparisons both on category pages
// (Venue, Flowers...) and standalone inside Project Management (stag do
// venue...). category_page_id being set is what ties a group's winner back
// into the budget/diary; a standalone group just tracks a winner locally.

export async function startOptionsMode(categoryPageId: string, title: string, revalidate: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("option_groups")
    .select("id")
    .eq("category_page_id", categoryPageId)
    .maybeSingle();
  if (existing) return existing.id as string;

  const profile = await getCurrentProfile();
  const { data } = await supabase
    .from("option_groups")
    .insert({ category_page_id: categoryPageId, title, created_by: profile?.id ?? null })
    .select("id")
    .single();

  revalidatePath(revalidate);
  return data?.id as string | undefined;
}

const standaloneSchema = z.object({ title: z.string().min(1) });

export async function createStandaloneOptionGroup(formData: FormData) {
  const parsed = standaloneSchema.parse({ title: formData.get("title") });
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  await supabase
    .from("option_groups")
    .insert({ category_page_id: null, title: parsed.title, created_by: profile?.id ?? null });

  revalidatePath("/project");
}

const optionSchema = z.object({
  groupId: z.string().uuid(),
  name: z.string().min(1),
  predictedCost: z.coerce.number().nonnegative().optional().nullable(),
  actualCost: z.coerce.number().nonnegative().optional().nullable(),
  optionDate: z.string().optional().or(z.literal("")),
  contactName: z.string().optional().or(z.literal("")),
  contactPhone: z.string().optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  revalidate: z.string(),
});

export async function addOption(formData: FormData) {
  const parsed = optionSchema.parse({
    groupId: formData.get("groupId"),
    name: formData.get("name"),
    predictedCost: formData.get("predictedCost") || null,
    actualCost: formData.get("actualCost") || null,
    optionDate: formData.get("optionDate") || "",
    contactName: formData.get("contactName") || "",
    contactPhone: formData.get("contactPhone") || "",
    contactEmail: formData.get("contactEmail") || "",
    revalidate: formData.get("revalidate"),
  });

  const supabase = await createClient();
  await supabase.from("page_options").insert({
    option_group_id: parsed.groupId,
    name: parsed.name,
    predicted_cost: parsed.predictedCost,
    actual_cost: parsed.actualCost,
    option_date: parsed.optionDate || null,
    contact_name: parsed.contactName || null,
    contact_phone: parsed.contactPhone || null,
    contact_email: parsed.contactEmail || null,
  });

  revalidatePath(parsed.revalidate);
}

export async function selectWinner(
  groupId: string,
  optionId: string,
  categoryPageId: string | null,
  revalidate: string
) {
  const supabase = await createClient();

  await supabase.from("page_options").update({ is_winner: false }).eq("option_group_id", groupId);
  const { data: option } = await supabase
    .from("page_options")
    .update({ is_winner: true })
    .eq("id", optionId)
    .select("name, predicted_cost, actual_cost, option_date, contact_name, contact_phone, contact_email")
    .single();

  // Only category-linked groups feed the budget/diary/contacts — a
  // standalone (Project Management) group's winner is informational only.
  if (categoryPageId && option) {
    const { data: existingCost } = await supabase
      .from("category_costs")
      .select("id")
      .eq("category_page_id", categoryPageId)
      .maybeSingle();

    if (existingCost) {
      await supabase
        .from("category_costs")
        .update({
          predicted_cost: option.predicted_cost,
          actual_cost: option.actual_cost,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingCost.id);
    } else {
      await supabase.from("category_costs").insert({
        category_page_id: categoryPageId,
        predicted_cost: option.predicted_cost,
        actual_cost: option.actual_cost,
      });
    }

    if (option.option_date) {
      await supabase.from("diary_entries").insert({
        title: `${option.name} — selected`,
        entry_date: option.option_date,
        source: "page_option",
        category_page_id: categoryPageId,
      });
    }

    if (option.contact_name) {
      await supabase.from("category_contacts").insert({
        category_page_id: categoryPageId,
        name: option.contact_name,
        phone: option.contact_phone,
        email: option.contact_email,
      });
    }
  }

  revalidatePath(revalidate);
  revalidatePath("/budget");
  revalidatePath("/diary");
}
