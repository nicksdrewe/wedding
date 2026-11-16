// The picture that stands for an option in compact lists: its first image by
// sort order. Takes the shape Supabase returns for an embedded
// page_option_images(image_url, sort_order) select.
export const OPTION_COVER_EMBED = "page_option_images(image_url, sort_order)";

export function coverImageOf(option: {
  page_option_images?: { image_url: string; sort_order: number | null }[] | { image_url: string; sort_order: number | null } | null;
}): string | null {
  const raw = option.page_option_images;
  const images = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (images.length === 0) return null;
  return [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0].image_url;
}
