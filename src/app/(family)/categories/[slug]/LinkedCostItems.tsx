"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { unlinkCostItem } from "@/lib/costs/links";
import { formatCurrency } from "@/lib/currency/format";
import { toDriveImageUrl } from "@/lib/google/image-url";
import type { getLinkedCostItemsForCategory } from "@/lib/costs/links";

type LinkedItem = Awaited<ReturnType<typeof getLinkedCostItemsForCategory>>[number];

// Read + unlink only — editing the underlying line item (name, amount,
// which option it belongs to) happens at its source category, not here,
// so there's only ever one edit surface for a given cost line.
export function LinkedCostItems({ items, isCouple }: { items: LinkedItem[]; isCouple: boolean }) {
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleUnlink(linkId: string) {
    setError(null);
    setUnlinkingId(linkId);
    startTransition(async () => {
      const result = await unlinkCostItem(linkId);
      if (result?.error) setError(result.error);
      setUnlinkingId(null);
    });
  }

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((link) => {
        const costItem = Array.isArray(link.option_cost_items) ? link.option_cost_items[0] : link.option_cost_items;
        if (!costItem) return null;
        const option = Array.isArray(costItem.page_options) ? costItem.page_options[0] : costItem.page_options;
        if (!option) return null;
        const group = Array.isArray(option.option_groups) ? option.option_groups[0] : option.option_groups;
        const sourceCategory = group
          ? Array.isArray(group.category_pages)
            ? group.category_pages[0]
            : group.category_pages
          : null;
        const images = Array.isArray(option.page_option_images) ? option.page_option_images : [];
        const cover = [...images].sort((a, b) => a.sort_order - b.sort_order)[0];

        return (
          <div key={link.id} className="overflow-hidden rounded-[10px] border border-ink/10 bg-white">
            <div className="relative aspect-[4/3] w-full bg-cream-deep">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={toDriveImageUrl(cover.image_url)}
                  alt={option.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full" />
              )}
            </div>
            <div className="p-4">
              <p className="font-serif text-sm font-semibold text-ink">{option.name}</p>
              <p className="mt-0.5 font-reading text-xs text-ink-soft/70">{costItem.name}</p>
              <p className="mt-1 font-reading text-[13px] text-ink-soft">
                {formatCurrency(costItem.amount, option.currency)}
              </p>
              {sourceCategory && (
                <Link
                  href={`/categories/${sourceCategory.slug}`}
                  className="mt-1.5 inline-block font-serif text-[11px] tracking-[0.06em] text-accent uppercase hover:underline"
                >
                  From {sourceCategory.title} →
                </Link>
              )}
              {isCouple && (
                <button
                  type="button"
                  onClick={() => handleUnlink(link.id)}
                  disabled={unlinkingId === link.id}
                  className="mt-2 block font-serif text-[11px] tracking-[0.06em] text-alert/80 uppercase hover:text-alert disabled:opacity-60"
                >
                  {unlinkingId === link.id ? "Removing…" : "Unlink"}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {error && <p className="col-span-full font-reading text-xs text-alert">{error}</p>}
    </div>
  );
}
