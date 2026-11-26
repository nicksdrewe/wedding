"use server";

import { revalidatePath } from "next/cache";
import { applyTypedLocation } from "@/lib/geo/form";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notifyWinnerChosen } from "@/lib/push/send";
import { getCurrentProfile } from "@/lib/auth/roles";
import { computeOptionTotals } from "./totals";

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

type OptionCostInput = {
  predictedCostMin?: number | null;
  predictedCostMax?: number | null;
  actualCost?: number | null;
  currency: "GBP" | "EUR";
};

// Prices live in page_option_costs, not on page_options (0031_cost_access
// .sql). The row already exists — a trigger creates it with the option — so
// this is always an UPDATE, and RLS only lets it through for someone allowed
// to see AND edit this option's prices. Zero rows back means exactly that it
// was refused, which is reported rather than swallowed.
async function writeOptionCosts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  optionId: string,
  costs: OptionCostInput
): Promise<string | null> {
  const { data, error } = await supabase
    .from("page_option_costs")
    .update({
      predicted_cost_min: costs.predictedCostMin ?? null,
      predicted_cost_max: costs.predictedCostMax ?? null,
      actual_cost: costs.actualCost ?? null,
      currency: costs.currency,
      updated_at: new Date().toISOString(),
    })
    .eq("page_option_id", optionId)
    .select("page_option_id");
  if (error) return error.message;
  if (!data || data.length === 0) {
    return "The option was saved, but its costs couldn't be — you may not have access to prices here.";
  }
  return null;
}

// Forms only render cost inputs for someone allowed to see prices, and mark
// that with this field. Without it the action must leave existing prices
// alone — otherwise a save by someone who can't see them would blank them.
function hasCostFields(formData: FormData) {
  return formData.get("hasCostFields") === "1";
}

const optionSchema = z
  .object({
    groupId: z.string().uuid(),
    name: z.string().min(1),
    predictedCostMin: z.coerce.number().nonnegative().optional().nullable(),
    predictedCostMax: z.coerce.number().nonnegative().optional().nullable(),
    actualCost: z.coerce.number().nonnegative().optional().nullable(),
    currency: z.enum(["GBP", "EUR"]),
    optionDate: z.string().optional().or(z.literal("")),
    contactName: z.string().optional().or(z.literal("")),
    contactPhone: z.string().optional().or(z.literal("")),
    contactEmail: z.string().email().optional().or(z.literal("")),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    nights: z.coerce.number().int().nonnegative().optional().nullable(),
    sleeps: z.coerce.number().int().nonnegative().optional().nullable(),
    revalidate: z.string(),
  })
  .refine(
    (v) => v.predictedCostMin == null || v.predictedCostMax == null || v.predictedCostMin <= v.predictedCostMax,
    { message: "Minimum predicted cost can't be higher than the maximum.", path: ["predictedCostMax"] }
  );

export async function addOption(formData: FormData) {
  await applyTypedLocation(formData);
  const parsed = optionSchema.parse({
    groupId: formData.get("groupId"),
    name: formData.get("name"),
    predictedCostMin: formData.get("predictedCostMin") || null,
    predictedCostMax: formData.get("predictedCostMax") || null,
    actualCost: formData.get("actualCost") || null,
    currency: formData.get("currency") || "GBP",
    optionDate: formData.get("optionDate") || "",
    contactName: formData.get("contactName") || "",
    contactPhone: formData.get("contactPhone") || "",
    contactEmail: formData.get("contactEmail") || "",
    latitude: formData.get("latitude") || null,
    longitude: formData.get("longitude") || null,
    nights: formData.get("nights") || null,
    sleeps: formData.get("sleeps") || null,
    revalidate: formData.get("revalidate"),
  });

  const supabase = await createClient();
  const { data: created, error: insertError } = await supabase
    .from("page_options")
    .insert({
      option_group_id: parsed.groupId,
      name: parsed.name,
      option_date: parsed.optionDate || null,
      contact_name: parsed.contactName || null,
      contact_phone: parsed.contactPhone || null,
      contact_email: parsed.contactEmail || null,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      nights: parsed.nights,
      sleeps: parsed.sleeps,
    })
    .select("id")
    .single();

  let error: string | null = insertError?.message ?? null;
  if (!error && created && hasCostFields(formData)) {
    error = await writeOptionCosts(supabase, created.id, parsed);
  }

  // Revalidate every surface that reads page_options, not just whichever
  // page the form happened to be rendered on — an option added from the
  // category board also needs Project Management's cross-category
  // comparison to pick it up, and vice versa. This was previously only
  // revalidating the single passed-in path.
  revalidatePath(parsed.revalidate);
  revalidatePath("/categories");
  revalidatePath("/project");

  return { error };
}

const updateOptionSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().optional().or(z.literal("")),
    webLink: z.string().optional().or(z.literal("")),
    predictedCostMin: z.coerce.number().nonnegative().optional().nullable(),
    predictedCostMax: z.coerce.number().nonnegative().optional().nullable(),
    actualCost: z.coerce.number().nonnegative().optional().nullable(),
    currency: z.enum(["GBP", "EUR"]),
    optionDate: z.string().optional().or(z.literal("")),
    contactName: z.string().optional().or(z.literal("")),
    contactPhone: z.string().optional().or(z.literal("")),
    contactEmail: z.string().email().optional().or(z.literal("")),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    nights: z.coerce.number().int().nonnegative().optional().nullable(),
    sleeps: z.coerce.number().int().nonnegative().optional().nullable(),
    revalidate: z.string(),
  })
  .refine(
    (v) => v.predictedCostMin == null || v.predictedCostMax == null || v.predictedCostMin <= v.predictedCostMax,
    { message: "Minimum predicted cost can't be higher than the maximum.", path: ["predictedCostMax"] }
  );

// Full edit of every page_options field, including description and
// web_link — addOption never exposed those (they were only ever set
// elsewhere, if at all), so this is the first form that can write them.
export async function updateOption(formData: FormData) {
  await applyTypedLocation(formData);
  const parsed = updateOptionSchema.parse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") || "",
    webLink: formData.get("webLink") || "",
    predictedCostMin: formData.get("predictedCostMin") || null,
    predictedCostMax: formData.get("predictedCostMax") || null,
    actualCost: formData.get("actualCost") || null,
    currency: formData.get("currency") || "GBP",
    optionDate: formData.get("optionDate") || "",
    contactName: formData.get("contactName") || "",
    contactPhone: formData.get("contactPhone") || "",
    contactEmail: formData.get("contactEmail") || "",
    latitude: formData.get("latitude") || null,
    longitude: formData.get("longitude") || null,
    nights: formData.get("nights") || null,
    sleeps: formData.get("sleeps") || null,
    revalidate: formData.get("revalidate"),
  });

  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from("page_options")
    .update({
      name: parsed.name,
      description: parsed.description || null,
      web_link: parsed.webLink || null,
      option_date: parsed.optionDate || null,
      contact_name: parsed.contactName || null,
      contact_phone: parsed.contactPhone || null,
      contact_email: parsed.contactEmail || null,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      nights: parsed.nights,
      sleeps: parsed.sleeps,
    })
    .eq("id", parsed.id);

  let error: string | null = updateError?.message ?? null;
  if (!error && hasCostFields(formData)) {
    error = await writeOptionCosts(supabase, parsed.id, parsed);
  }

  revalidatePath(parsed.revalidate);
  revalidatePath("/categories");
  revalidatePath("/budget");
  revalidatePath("/project");

  return { error };
}

// Deletes the whole option (page_option_images cascade with it per 0006 —
// same removal precedent as removeOptionImage, just at the row level).
export async function deleteOption(id: string, revalidate: string) {
  const parsed = z.string().uuid().parse(id);
  const supabase = await createClient();

  const { error } = await supabase.from("page_options").delete().eq("id", parsed);

  revalidatePath(revalidate);
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
    .select("name, option_date, contact_name, contact_phone, contact_email")
    .single();

  // Only category-linked groups feed the budget/diary/contacts — a
  // standalone (Project Management) group's winner is informational only.
  if (categoryPageId && option) {
    const [{ data: costItems }, { data: costs }] = await Promise.all([
      supabase.from("option_cost_items").select("amount, kind").eq("page_option_id", optionId),
      supabase
        .from("page_option_costs")
        .select("predicted_cost_min, predicted_cost_max, actual_cost, currency")
        .eq("page_option_id", optionId)
        .maybeSingle(),
    ]);
    // The category's budget total is the option's TRUE cost — base plus
    // every additional line, minus any income (guest recoup) — not just
    // its own headline figure. See lib/options/totals.ts; this must stay
    // the one shared calculation selectWinner/markOptionWinner/the option
    // card all use, or the number on the card would stop matching what
    // actually lands on the Budget page.
    // No cost row back means this user can't see the option's prices — the
    // category total is then left exactly as it was rather than being
    // overwritten with blanks.
    if (costs) {
      const totals = computeOptionTotals(costs, costItems ?? []);

      const { data: existingCost } = await supabase
        .from("category_costs")
        .select("id")
        .eq("category_page_id", categoryPageId)
        .maybeSingle();

    // Both predicted range and actual copy across together — these two
    // call sites (selectWinner/markOptionWinner) previously drifted, one
    // copying both fields and the other only actual_cost, leaving
    // category_costs' predicted range stale after a winner was picked
    // through this path.
      if (existingCost) {
        await supabase
          .from("category_costs")
          .update({
            predicted_cost_min: totals.totalMin,
            predicted_cost_max: totals.totalMax,
            actual_cost: totals.totalActual,
            currency: costs.currency,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingCost.id);
      } else {
        await supabase.from("category_costs").insert({
          category_page_id: categoryPageId,
          predicted_cost_min: totals.totalMin,
          predicted_cost_max: totals.totalMax,
          actual_cost: totals.totalActual,
          currency: costs.currency,
        });
      }
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
    .select("id, name, option_date, option_group_id")
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

    const { data: costItems, error: itemsError } = await supabase
      .from("option_cost_items")
      .select("amount, kind")
      .eq("page_option_id", optionId);
    if (itemsError) return { error: itemsError.message };

    const { data: costs, error: costsError } = await supabase
      .from("page_option_costs")
      .select("predicted_cost_min, predicted_cost_max, actual_cost, currency")
      .eq("page_option_id", optionId)
      .maybeSingle();
    if (costsError) return { error: costsError.message };

    // No cost row back means this user can't see the option's prices — the
    // category total is left as it was rather than overwritten with blanks.
    if (costs) {
      // Same shared calculation as selectWinner — see the comment there and
      // lib/options/totals.ts. The category total is the option's TRUE cost
      // (base + additional lines − income), not just its own headline figure.
      const totals = computeOptionTotals(costs, costItems ?? []);

      const { data: existingCost, error: costLookupError } = await supabase
        .from("category_costs")
        .select("id")
        .eq("category_page_id", categoryPageId)
        .maybeSingle();
      if (costLookupError) return { error: costLookupError.message };

      const { error: costError } = existingCost
        ? await supabase
            .from("category_costs")
            .update({
              predicted_cost_min: totals.totalMin,
              predicted_cost_max: totals.totalMax,
              actual_cost: totals.totalActual,
              currency: costs.currency,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingCost.id)
        : await supabase.from("category_costs").insert({
            category_page_id: categoryPageId,
            predicted_cost_min: totals.totalMin,
            predicted_cost_max: totals.totalMax,
            actual_cost: totals.totalActual,
            currency: costs.currency,
          });
      if (costError) return { error: costError.message };
    }
  }

  const actorId = (await getCurrentProfile())?.id ?? null;
  after(() => notifyWinnerChosen(optionId, actorId));

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

// Move an option to a different category (e.g. "Baked goods" from Monday
// breakfast to Sunday breakfast) without duplicating it: its photos, prices,
// cost lines, votes and comments all travel with it. It stops being the
// winner (that was a choice about the old category); organising-comms
// entries about it follow it to the new category. Couple only on a category
// board, because both categories' decisions change.
export async function moveOption(optionId: string, targetCategoryId: string, revalidate: string) {
  const ids = z.object({ optionId: z.string().uuid(), targetCategoryId: z.string().uuid() }).parse({ optionId, targetCategoryId });
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("option_groups")
    .select("id")
    .eq("category_page_id", ids.targetCategoryId)
    .maybeSingle();
  if (!group) return { error: "That category has no options board yet." };

  const { data: moved, error } = await supabase
    .from("page_options")
    .update({ option_group_id: group.id, is_winner: false })
    .eq("id", ids.optionId)
    .select("id");
  if (error) return { error: error.message };
  if (!moved || moved.length === 0) return { error: "You can't move this option." };

  // Best effort: comms tagged to this option now belong to the new category.
  await supabase.from("org_comms").update({ category_page_id: ids.targetCategoryId }).eq("page_option_id", ids.optionId);

  revalidatePath(revalidate);
  revalidatePath("/categories", "layout");
  revalidatePath("/budget");
  revalidatePath("/project");
  revalidatePath("/organising");
  return { error: null };
}

// Take the winner mark off an option (chosen by accident, or things changed).
// The category goes back to being undecided: its cost reverts to the range
// across its options, and the diary date that choosing a winner added is
// removed. Same rule as choosing one: on a category board that is the couple's
// call (enforced by the database).
export async function clearOptionWinner(optionId: string) {
  const id = z.string().uuid().parse(optionId);
  const supabase = await createClient();

  const { data: option, error: fetchError } = await supabase
    .from("page_options")
    .select("id, option_group_id, is_winner")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!option) return { error: "Option not found." };

  const { data: cleared, error } = await supabase
    .from("page_options")
    .update({ is_winner: false })
    .eq("id", id)
    .select("id, is_winner");
  if (error) return { error: error.message };
  if (!cleared || cleared.length === 0) return { error: "You can't change the winner here." };

  const { data: group } = await supabase.from("option_groups").select("category_page_id").eq("id", option.option_group_id).maybeSingle();
  if (group?.category_page_id) {
    // The diary date added when this category's winner was chosen.
    await supabase.from("diary_entries").delete().eq("category_page_id", group.category_page_id).eq("source", "page_option");
  }

  revalidatePath("/categories", "layout");
  revalidatePath("/budget");
  revalidatePath("/diary");
  revalidatePath("/project");
  return { error: null };
}
