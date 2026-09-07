// A venue/vendor URL typed without a protocol (e.g. "chateaudupuis.com" or
// "www.chateaudupuis.com") is a real address, but rendering it verbatim as
// an <a href> makes the browser treat it as a RELATIVE path against the
// current page instead of an external site — a venue link on
// /categories/venue silently resolves to something like
// weddingsweddings.co.uk/categories/chateaudupuis.com instead of leaving
// the site at all. Prepending https:// when no scheme is present fixes it
// regardless of whether the value was entered with or without one.
export function normalizeExternalUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
