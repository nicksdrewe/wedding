// Who a wedding's emails come from, and where replies go.
//
//   WEDDING_EMAIL_DOMAIN  a domain verified for sending in Resend. Emails then
//                         come from "Jon & Sarah" <jonsarah@that-domain>.
//                         Unset: the site-wide RESEND_FROM_EMAIL address, still
//                         under the couple's names.
//   WEDDING_INBOX_DOMAIN  a domain (or subdomain) Resend receives mail for.
//                         Replies then go to jonsarah@that-domain and land in
//                         the wedding's inbox on the site. Unset: replies go to
//                         wherever the sending address goes.

type WeddingLike = { slug: string; display_name: string } | null | undefined;

function addressOf(from: string | undefined) {
  if (!from) return null;
  return from.match(/<([^>]+)>/)?.[1] ?? from.trim();
}

function quoted(name: string) {
  return `"${name.replace(/["\\r\n]/g, "")}"`;
}

export function weddingFrom(wedding: WeddingLike): string | null {
  if (!wedding) return null;
  const domain = process.env.WEDDING_EMAIL_DOMAIN?.trim();
  const address = domain ? `${wedding.slug}@${domain}` : addressOf(process.env.RESEND_FROM_EMAIL);
  return address ? `${quoted(wedding.display_name)} <${address}>` : null;
}

export function weddingReplyTo(wedding: WeddingLike): string | null {
  const domain = process.env.WEDDING_INBOX_DOMAIN?.trim();
  return wedding && domain ? `${quoted(wedding.display_name)} <${wedding.slug}@${domain}>` : null;
}

/** The wedding slug an inbound address belongs to, e.g. jonsarah@reply.example -> jonsarah. */
export function slugFromInboxAddress(address: string): string | null {
  const domain = process.env.WEDDING_INBOX_DOMAIN?.trim().toLowerCase();
  const a = (addressOf(address) ?? "").toLowerCase();
  if (!domain || !a.endsWith(`@${domain}`)) return null;
  const local = a.slice(0, -(domain.length + 1)).split("+")[0];
  return local || null;
}
