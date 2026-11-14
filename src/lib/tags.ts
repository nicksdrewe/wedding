// Contact tags drive access (page_permissions rows, RLS helpers like
// fn_has_visible_tag, nav visibility), and every one of those compares tags
// by EXACT string match against snake_case keys (best_man, groomsman, …).
// Tags were previously saved exactly as typed ("Best Man", "Maid Of
// Honour"), which silently matched nothing. Everything that WRITES a
// contact tag goes through normalizeTag, and everything that READS tags for
// an access decision normalises again, so a legacy value can never slip past
// a comparison. Client-safe: no server imports.

export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function normalizeTags(tags: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of tags ?? []) {
    const t = normalizeTag(raw);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

// Comma-separated form input -> normalised, de-duplicated array.
export function parseTagInput(input: string | null | undefined): string[] {
  return normalizeTags((input ?? "").split(","));
}

// The tags that carry access meaning. Shown as one-tap toggles in the guest
// editor; anything else is a free-form label.
export const ROLE_TAGS = [
  { value: "best_man", label: "Best Man" },
  { value: "maid_of_honour", label: "Maid Of Honour" },
  { value: "groomsman", label: "Groomsman" },
  { value: "bridesmaid", label: "Bridesmaid" },
] as const;

export const ROLE_TAG_VALUES: readonly string[] = ROLE_TAGS.map((t) => t.value);

// "best_man" -> "Best Man"; unknown tags get the same treatment so they
// display tidily too.
export function tagLabel(tag: string): string {
  const known = ROLE_TAGS.find((t) => t.value === tag);
  if (known) return known.label;
  return tag
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
