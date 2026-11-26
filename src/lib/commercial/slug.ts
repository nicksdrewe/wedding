// A wedding address from two names: "Jon", "Sarah" -> "jonsarah".
export function suggestSlug(one: string, two: string) {
  const clean = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  return `${clean(one)}${clean(two)}`.slice(0, 40);
}

export function tidySlug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
