// The couple's names in the forms the site's wording needs. Client-safe.

export type WeddingNames = {
  slug: string;
  partnerOne: string;
  partnerTwo: string;
  displayName: string; // "Nick & Ellie"
  dateLabel: string | null; // "Summer 2028"
};

export const FALLBACK_NAMES: WeddingNames = {
  slug: "",
  partnerOne: "the couple",
  partnerTwo: "",
  displayName: "Weddings Weddings",
  dateLabel: null,
};

/** "Nick or Ellie" (for "ask Nick or Ellie"). */
export function eitherOf(n: WeddingNames) {
  return n.partnerTwo ? `${n.partnerOne} or ${n.partnerTwo}` : n.partnerOne;
}

/** "Nick & Ellie's" */
export function possessive(n: WeddingNames) {
  return `${n.displayName}’s`;
}

export function namesFrom(w: {
  slug: string;
  partner_one: string;
  partner_two: string;
  display_name: string;
  date_label: string | null;
  wedding_date?: string | null;
} | null): WeddingNames {
  if (!w) return FALLBACK_NAMES;
  const date =
    w.date_label ||
    (w.wedding_date
      ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date(w.wedding_date))
      : null);
  return { slug: w.slug, partnerOne: w.partner_one, partnerTwo: w.partner_two, displayName: w.display_name, dateLabel: date };
}
