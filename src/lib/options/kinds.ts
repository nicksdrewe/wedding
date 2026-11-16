// What kind of options a category holds (0046_category_option_kind.sql)
// decides which boxes its option forms show. Pure and client-safe.

export const OPTION_KINDS = [
  { value: "general", label: "Anything else", hint: "Name, price, photos, contact and date" },
  { value: "venue", label: "A place or venue", hint: "Also a map pin" },
  { value: "stay", label: "Somewhere to stay", hint: "Also a map pin, nights and how many it sleeps" },
] as const;

export type OptionKind = (typeof OPTION_KINDS)[number]["value"];

export type OptionFields = { location: boolean; stay: boolean };

// Unknown kind (a standalone comparison, or the column not there yet) shows
// every box, which is how the forms always behaved before kinds existed.
export function optionFieldsFor(kind: string | null | undefined): OptionFields {
  if (kind === "general") return { location: false, stay: false };
  if (kind === "venue") return { location: true, stay: false };
  return { location: true, stay: true };
}

export function parseOptionKind(raw: unknown): OptionKind | null {
  return raw === "general" || raw === "venue" || raw === "stay" ? raw : null;
}
