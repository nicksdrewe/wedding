import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { AddOptionForm } from "./AddOptionForm";
import { OptionCard, type OptionDetail } from "./OptionCard";
import type { CostItemRow, CostItemLinkInfo } from "./CostItemsPanel";

// The visual option board for a category page: every page_option in the
// group, shown as an image-first card that expands (via Disclosure) into
// the full detail — all images, description, web link, contact info, its
// cost breakdown (option_cost_items — see 0026_option_cost_items.sql), and
// the mark-as-winner action. This is deliberately separate from
// OptionGroupPanel/OptionsGrid (the compare-and-commit ritual used here
// previously, and still used as-is by Project Management's standalone
// groups at /project) rather than a shared rewrite of it, since the two
// screens now want different interactions over the same page_options rows.
export async function OptionsBoard({
  groupId,
  categoryPageId,
  revalidate,
  isCouple,
}: {
  groupId: string;
  categoryPageId: string | null;
  revalidate: string;
  isCouple: boolean;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("page_options")
    .select(
      "id, name, description, web_link, predicted_cost_min, predicted_cost_max, actual_cost, currency, option_date, contact_name, contact_phone, contact_email, latitude, longitude, nights, sleeps, is_winner, page_option_images(id, image_url, sort_order)"
    )
    .eq("option_group_id", groupId)
    .order("created_at")
    .order("sort_order", { referencedTable: "page_option_images", ascending: true });

  const optionIds = (data ?? []).map((o) => o.id);

  const { data: costItemRows } = optionIds.length > 0
    ? await supabase
        .from("option_cost_items")
        .select("id, page_option_id, name, kind, quantity, rate, amount")
        .in("page_option_id", optionIds)
        .order("created_at")
    : { data: [] };

  const costItemsByOption: Record<string, CostItemRow[]> = {};
  for (const item of costItemRows ?? []) {
    const list = costItemsByOption[item.page_option_id] ?? [];
    list.push({ id: item.id, name: item.name, kind: item.kind, quantity: item.quantity, rate: item.rate, amount: item.amount });
    costItemsByOption[item.page_option_id] = list;
  }

  // Linking a cost line into another category (0026_option_cost_items.sql)
  // only makes sense from a real category board, not Project Management's
  // standalone comparisons — categoryPageId is null there.
  let otherCategories: { id: string; title: string }[] = [];
  let linksByItem: Record<string, CostItemLinkInfo[]> = {};
  if (categoryPageId && isCouple) {
    const costItemIds = (costItemRows ?? []).map((i) => i.id);
    const [{ data: categories }, { data: links }] = await Promise.all([
      supabase.from("category_pages").select("id, title").neq("id", categoryPageId).order("title"),
      costItemIds.length > 0
        ? supabase
            .from("cost_item_links")
            .select("id, source_cost_item_id, category_pages!linked_category_page_id (title)")
            .in("source_cost_item_id", costItemIds)
        : Promise.resolve({ data: [] }),
    ]);
    otherCategories = categories ?? [];
    linksByItem = (links ?? []).reduce<Record<string, CostItemLinkInfo[]>>((acc, l) => {
      const category = Array.isArray(l.category_pages) ? l.category_pages[0] : l.category_pages;
      const entry = { id: l.id, categoryTitle: category?.title ?? "Unknown" };
      acc[l.source_cost_item_id] = [...(acc[l.source_cost_item_id] ?? []), entry];
      return acc;
    }, {});
  }

  const options: OptionDetail[] = (data ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    description: o.description,
    web_link: o.web_link,
    predicted_cost_min: o.predicted_cost_min,
    predicted_cost_max: o.predicted_cost_max,
    actual_cost: o.actual_cost,
    currency: o.currency,
    option_date: o.option_date,
    contact_name: o.contact_name,
    contact_phone: o.contact_phone,
    contact_email: o.contact_email,
    latitude: o.latitude,
    longitude: o.longitude,
    nights: o.nights,
    sleeps: o.sleeps,
    is_winner: o.is_winner,
    images: (o.page_option_images ?? []).map(
      (img: { id: string; image_url: string; sort_order: number }) => ({
        id: img.id,
        image_url: img.image_url,
        sort_order: img.sort_order,
      })
    ),
  }));

  return (
    <div className="mt-3">
      {options.length === 0 ? (
        <EmptyState
          title="No options yet"
          hint={
            isCouple
              ? "Add the first option below to start the board."
              : "Nothing has been added here yet."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((option) => (
            <OptionCard
              key={option.id}
              option={option}
              isCouple={isCouple}
              revalidate={revalidate}
              costItems={costItemsByOption[option.id] ?? []}
              linkableCategories={otherCategories}
              linksByItem={linksByItem}
            />
          ))}
        </div>
      )}
      {isCouple && (
        <div className="mt-4">
          <AddOptionForm groupId={groupId} revalidate={revalidate} />
        </div>
      )}
    </div>
  );
}
