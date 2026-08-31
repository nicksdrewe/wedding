"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";

const linkSchema = z.object({
  sourcePageOptionId: z.string().uuid(),
  targetCategoryPageId: z.string().uuid(),
});

// Links one existing option's cost into a second category, so it shows up
// there too (see 0024_linked_cost_items.sql) without duplicating the row —
// only page_options.category_page_id via option_groups changes rows, this
// table just points at one.
export async function linkCostItem(formData: FormData) {
  const parsed = linkSchema.parse({
    sourcePageOptionId: formData.get("sourcePageOptionId"),
    targetCategoryPageId: formData.get("targetCategoryPageId"),
  });

  const supabase = await createClient();

  // A category linking into itself would just be its own options board
  // twice over — resolved via the option's group rather than trusted from
  // the client, since the option's actual source category isn't otherwise
  // available to the form that submits this.
  const { data: option } = await supabase
    .from("page_options")
    .select("option_group_id, option_groups(category_page_id)")
    .eq("id", parsed.sourcePageOptionId)
    .maybeSingle();
  const group = Array.isArray(option?.option_groups) ? option.option_groups[0] : option?.option_groups;
  if (group?.category_page_id === parsed.targetCategoryPageId) {
    return { error: "That's already this item's own category." };
  }

  const profile = await getCurrentProfile();
  const { error } = await supabase.from("cost_item_links").insert({
    source_page_option_id: parsed.sourcePageOptionId,
    linked_category_page_id: parsed.targetCategoryPageId,
    created_by: profile?.id ?? null,
  });

  revalidatePath("/categories");
  return { error: error?.message ?? null };
}

export async function unlinkCostItem(linkId: string) {
  const parsed = z.string().uuid().parse(linkId);
  const supabase = await createClient();

  const { error } = await supabase.from("cost_item_links").delete().eq("id", parsed);

  revalidatePath("/categories");
  return { error: error?.message ?? null };
}

export async function getLinkedCostItemsForCategory(categoryPageId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("cost_item_links")
    .select(
      `id, source_page_option_id,
       page_options!cost_item_links_source_page_option_id_fkey (
         id, name, predicted_cost_min, predicted_cost_max, actual_cost, currency,
         option_groups (category_page_id, category_pages (title, slug)),
         page_option_images (image_url, sort_order)
       )`
    )
    .eq("linked_category_page_id", categoryPageId)
    .order("created_at");

  return data ?? [];
}
