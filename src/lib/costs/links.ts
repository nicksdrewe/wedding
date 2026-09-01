"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";

const linkSchema = z.object({
  sourceCostItemId: z.string().uuid(),
  targetCategoryPageId: z.string().uuid(),
});

// Links one cost-breakdown line item (e.g. "Wedding breakfast" under a
// Venue option) into a second category, so it shows up there too — see
// 0026_option_cost_items.sql, which moved linking down from the whole
// option to a single line, matching how the couple actually uses it
// ("the wedding breakfast should also show under Catering", not the
// entire venue booking).
export async function linkCostItem(formData: FormData) {
  const parsed = linkSchema.parse({
    sourceCostItemId: formData.get("sourceCostItemId"),
    targetCategoryPageId: formData.get("targetCategoryPageId"),
  });

  const supabase = await createClient();

  // A category linking into itself would just be its own options board
  // twice over — resolved via the line item's option's group rather than
  // trusted from the client.
  const { data: item } = await supabase
    .from("option_cost_items")
    .select("page_options (option_groups (category_page_id))")
    .eq("id", parsed.sourceCostItemId)
    .maybeSingle();
  const option = Array.isArray(item?.page_options) ? item.page_options[0] : item?.page_options;
  const group = Array.isArray(option?.option_groups) ? option.option_groups[0] : option?.option_groups;
  if (group?.category_page_id === parsed.targetCategoryPageId) {
    return { error: "That's already this item's own category." };
  }

  const profile = await getCurrentProfile();
  const { error } = await supabase.from("cost_item_links").insert({
    source_cost_item_id: parsed.sourceCostItemId,
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
      `id, source_cost_item_id,
       option_cost_items!cost_item_links_source_cost_item_id_fkey (
         id, name, amount, kind,
         page_options (
           id, name, currency,
           option_groups (category_page_id, category_pages (title, slug)),
           page_option_images (image_url, sort_order)
         )
       )`
    )
    .eq("linked_category_page_id", categoryPageId)
    .order("created_at");

  return data ?? [];
}
