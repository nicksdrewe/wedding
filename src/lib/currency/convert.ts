import type { FxRates } from "./rates";

export type Currency = "GBP" | "EUR";

// rates.rates[currency] is "how many of that currency per GBP", so going
// the other way (currency -> GBP) divides.
export function convertToGBP(amount: number, currency: Currency, rates: FxRates): number {
  if (currency === "GBP") return amount;
  const rate = rates.rates[currency];
  if (!rate) return amount;
  return amount / rate;
}
