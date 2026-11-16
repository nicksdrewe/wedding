// Date helpers that treat a day as a plain YYYY-MM-DD string. All maths is in
// UTC so the user's timezone can never shift a day.

export const MAX_SPAN_DAYS = 14;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDay(value: string): boolean {
  if (!DAY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toUtc(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(day: string, n: number): string {
  return new Date(toUtc(day) + n * 86400000).toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string): number {
  return Math.round((toUtc(end) - toUtc(start)) / 86400000);
}

/** Every day from start to end inclusive; empty if the range is invalid. */
export function listDays(start: string | null, end: string | null): string[] {
  if (!start || !end || !isDay(start) || !isDay(end)) return [];
  const span = daysBetween(start, end);
  if (span < 0 || span > MAX_SPAN_DAYS - 1) return [];
  return Array.from({ length: span + 1 }, (_, i) => addDays(start, i));
}

export function weekdayOf(day: string, style: "short" | "long" = "short"): string {
  return new Date(toUtc(day)).toLocaleDateString("en-GB", { weekday: style, timeZone: "UTC" });
}

export function shortDate(day: string): string {
  return new Date(toUtc(day)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function longDate(day: string): string {
  return new Date(toUtc(day)).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
