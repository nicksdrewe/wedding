import type { MapOption } from "@/components/options/OptionsMap";
import type { CategoryNode } from "./tree";

// One map pin for each category that has a place of its own (set in Edit), with
// its total cost, linking to its page. "Stag" shows its destinations this way;
// each destination's own page then maps the options inside it. Categories with
// no place (Outfits) give no pins, so no map. Pure.
export function placePins(nodes: CategoryNode[], basePath: string): MapOption[] {
  return nodes
    .filter((n) => n.pin?.own)
    .map((n) => ({
      id: n.id,
      name: n.title,
      predicted_cost_min: n.total?.min ?? null,
      predicted_cost_max: n.total?.max ?? null,
      currency: "GBP" as const,
      costs_hidden: !n.costAccess || !n.total,
      latitude: n.pin!.lat,
      longitude: n.pin!.lng,
      coverImageUrl: null,
      href: `${basePath}/${n.slug}`,
      note: n.children.length > 0 ? `${n.children.length} inside` : n.winners.length > 0 ? `Chosen: ${n.winners.join(", ")}` : undefined,
    }));
}
