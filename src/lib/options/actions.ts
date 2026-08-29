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
  const { error } = await supabase.from("page_options").insert({
    option_group_id: parsed.groupId,
    name: parsed.name,
    predicted_cost: parsed.predictedCost,
    actual_cost: parsed.actualCost,
    option_date: parsed.optionDate || null,
    contact_name: parsed.contactName || null,
    contact_phone: parsed.contactPhone || null,
    contact_email: parsed.contactEmail || null,
  });

  // Revalidate every surface that reads page_options, not just whichever
  // page the form happened to be rendered on — an option added from the
  // category board also needs Project Management's cross-category
  // comparison to pick it up, and vice versa. This was previously only
  // revalidating the single passed-in path.
  revalidatePath(parsed.revalidate);
  revalidatePath("/categories");
  revalidatePath("/project");

  return { error: error?.message ?? null };
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

// ---------------------------------------------------------------------------
// markOptionWinner: the error-checked counterpart to selectWinner above.
// selectWinner drives the OptionsGrid comparison UI (it already knows
// groupId/categoryPageId/revalidate from props and never surfaces errors —
// it's a fire-and-forget client transition). This one takes just the option
// id (page_options no longer carries category_page_id directly since
// 0004_option_groups.sql — it hangs off option_groups instead, so we look it
// up), checks every Supabase call, and is meant for the category board /
// project skim view where a caller needs { error } back. It applies the same
// exclusivity-within-group rule selectWinner does, rather than duplicating a
// third implementation of it.
export async function markOptionWinner(optionId: string) {
  const supabase = await createClient();

  const { data: option, error: fetchError } = await supabase
    .from("page_options")
    .select("id, name, actual_cost, option_date, option_group_id")
    .eq("id", optionId)
    .single();
  if (fetchError) return { error: fetchError.message };
  if (!option) return { error: "Option not found." };

  const { data: group, error: groupError } = await supabase
    .from("option_groups")
    .select("category_page_id")
    .eq("id", option.option_group_id)
    .single();
  if (groupError) return { error: groupError.message };

  const categoryPageId = group?.category_page_id ?? null;

  const { error: clearError } = await supabase
    .from("page_options")
    .update({ is_winner: false })
    .eq("option_group_id", option.option_group_id);
  if (clearError) return { error: clearError.message };

  const { error: winError } = await supabase
    .from("page_options")
    .update({ is_winner: true })
    .eq("id", optionId);
  if (winError) return { error: winError.message };

  // Standalone (Project Management) groups have no category to roll into —
  // per the brief, their winner is informational only.
  if (categoryPageId) {
    if (option.option_date) {
      // Keyed on category_page_id + source, not title: option_groups_one_
      // per_category (0004) guarantees at most one options comparison per
      // category, so at most one page_option-sourced diary entry ever
      // applies here — this survives the option being renamed later.
      const { data: existingEntry, error: entryLookupError } = await supabase
        .from("diary_entries")
        .select("id")
        .eq("category_page_id", categoryPageId)
        .eq("source", "page_option")
        .maybeSingle();
      if (entryLookupError) return { error: entryLookupError.message };

      const { error: diaryError } = existingEntry
        ? await supabase
            .from("diary_entries")
            .update({ title: option.name, entry_date: option.option_date })
            .eq("id", existingEntry.id)
        : await supabase.from("diary_entries").insert({
            title: option.name,
            entry_date: option.option_date,
            source: "page_option",
            category_page_id: categoryPageId,
          });
      if (diaryError) return { error: diaryError.message };
    }

    const { data: existingCost, error: costLookupError } = await supabase
      .from("category_costs")
      .select("id")
      .eq("category_page_id", categoryPageId)
      .maybeSingle();
    if (costLookupError) return { error: costLookupError.message };

    const { error: costError } = existingCost
      ? await supabase
          .from("category_costs")
          .update({ actual_cost: option.actual_cost, updated_at: new Date().toISOString() })
          .eq("id", existingCost.id)
      : await supabase.from("category_costs").insert({
          category_page_id: categoryPageId,
          actual_cost: option.actual_cost,
        });
    if (costError) return { error: costError.message };
  }

  revalidatePath("/categories");
  revalidatePath("/budget");
  revalidatePath("/diary");
  revalidatePath("/project");

  return { error: null };
}

const addOptionImageSchema = z.object({
  optionId: z.string().uuid(),
  imageUrl: z.string().min(1),
});

export async function addOptionImage(optionId: string, imageUrl: string) {
  const parsed = addOptionImageSchema.parse({ optionId, imageUrl });
  const supabase = await createClient();

  const { data: existing, error: countError } = await supabase
    .from("page_option_images")
    .select("sort_order")
    .eq("page_option_id", parsed.optionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (countError) return { error: countError.message };

  const nextSortOrder = (existing?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("page_option_images").insert({
    page_option_id: parsed.optionId,
    image_url: parsed.imageUrl,
    sort_order: nextSortOrder,
  });
  if (error) return { error: error.message };

  revalidatePath("/categories");
  revalidatePath("/project");
  return { error: null };
}

export async function removeOptionImage(imageId: string) {
  const parsed = z.string().uuid().parse(imageId);
  const supabase = await createClient();

  const { error } = await supabase.from("page_option_images").delete().eq("id", parsed);
  if (error) return { error: error.message };

  revalidatePath("/categories");
  revalidatePath("/project");
  return { error: null };
}
