// The one price, shown on the commercial site. There is no payment yet: during
// the alpha a code takes it to nothing (see 0058_signup_codes.sql).
export const PRICE = {
  amount: 149,
  currency: "GBP",
  label: "£149",
  per: "per wedding, paid once",
} as const;

export const SITE_NAME = "Weddings Weddings";
export const SITE_URL = `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "weddingsweddings.co.uk"}`;
