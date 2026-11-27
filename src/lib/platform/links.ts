import { headers } from "next/headers";
import { ROOT_DOMAIN, slugFromHost } from "@/lib/wedding/host";

/**
 * A link into a wedding's own site. On the real domain that's its subdomain;
 * on previews and localhost there's only one address, so ?wedding= picks it.
 */
export async function weddingLinkFactory() {
  const host = (await headers()).get("host");
  const onRealDomain = !!slugFromHost(host) || (host ?? "").split(":")[0].replace(/^www\./, "") === ROOT_DOMAIN;
  return (slug: string, path = "/") => {
    if (onRealDomain) return `https://${slug}.${ROOT_DOMAIN}${path}`;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}wedding=${slug}`;
  };
}
