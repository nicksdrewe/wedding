import type { Currency } from "./convert";

const FORMATTERS: Record<Currency, Intl.NumberFormat> = {
  GBP: new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }),
  EUR: new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
};

export function formatCurrency(amount: number, currency: Currency = "GBP"): string {
  return FORMATTERS[currency].format(amount);
}

export function formatCostRange(min: number | null, max: number | null, currency: Currency = "GBP"): string {
  if (min == null && max == null) return "—";
  if (min == null) return formatCurrency(max as number, currency);
  if (max == null) return formatCurrency(min, currency);
  if (min === max) return formatCurrency(min, currency);
  return `${formatCurrency(min, currency)}–${formatCurrency(max, currency)}`;
}
