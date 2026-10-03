// Where guests send a contribution to the wedding fund. Deliberately a plain
// config file rather than env vars or a DB table: these are public-facing
// details (the page shows them to guests), they change essentially never,
// and a code change here deploys with the rest of the site.
//
// Leave a field null and the gifts page simply doesn't render that part —
// the page shows a "details coming soon" note until the three bank fields
// below are all filled in, so nothing half-configured ever reaches guests.
export type WeddingFundConfig = {
  accountName: string | null;
  sortCode: string | null; // e.g. "12-34-56"
  accountNumber: string | null; // 8 digits
  // Suggested payment reference so contributions are easy to match up when
  // thanking people. Guests are told to add their own name after it.
  reference: string;
  // Optional one-tap pay link (e.g. a monzo.me / Revolut / PayPal.me URL) —
  // shown as a button above the manual bank details when set.
  payLink: { label: string; href: string } | null;
};

export const WEDDING_FUND: WeddingFundConfig = {
  accountName: "Nicholas Drewe",
  sortCode: "04-00-04",
  accountNumber: "17400256",
  reference: "Wedding fund",
  payLink: { label: "Gift to the wedding Monzo", href: "https://monzo.me/nicholasdrewe2" },
};

export function hasBankDetails(fund: WeddingFundConfig): boolean {
  return Boolean(fund.accountName && fund.sortCode && fund.accountNumber);
}
