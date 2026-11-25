// Which wedding an address belongs to. Edge-safe (used by middleware).
//
//   jonsarah.weddingsweddings.co.uk  -> "jonsarah"
//   weddingsweddings.co.uk / www     -> the default wedding for now (phase 3
//                                        turns the main domain into the
//                                        commercial site)
//   *.vercel.app, localhost          -> the default wedding, or the one picked
//                                        with ?wedding=<slug> (kept in a cookie)

export const WEDDING_HEADER = "x-wedding-id";
export const WEDDING_SLUG_HEADER = "x-wedding-slug";
export const WEDDING_COOKIE = "ww-wedding";
export const WEDDING_PICK_COOKIE = "ww-wedding-pick";

export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "weddingsweddings.co.uk";
export const DEFAULT_WEDDING_SLUG = process.env.DEFAULT_WEDDING_SLUG || "nickellie";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** The wedding subdomain in this address, or null for the main domain and anything else. */
export function slugFromHost(host: string | null): string | null {
  if (!host) return null;
  const h = host.toLowerCase().split(":")[0];
  if (h === ROOT_DOMAIN || h === `www.${ROOT_DOMAIN}`) return null;
  if (!h.endsWith(`.${ROOT_DOMAIN}`)) return null;
  const sub = h.slice(0, -(ROOT_DOMAIN.length + 1));
  return SLUG_RE.test(sub) ? sub : null;
}

export function isValidSlug(s: string | null | undefined): s is string {
  return !!s && SLUG_RE.test(s);
}

/** The address of a wedding's own site. */
export function weddingUrl(slug: string, path = "/") {
  return `https://${slug}.${ROOT_DOMAIN}${path}`;
}
