import { createHmac, timingSafeEqual } from "node:crypto";
import { ROOT_DOMAIN } from "@/lib/wedding/host";
import { SITE_NAME } from "@/lib/commercial/pricing";

// Newsletter helpers: the unsubscribe link every issue carries, and turning
// the plain text written in the console into a simple, readable email.

function key() {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "missing").update("ww-unsubscribe").digest();
}

export function unsubscribeSig(email: string) {
  return createHmac("sha256", key()).update(email.toLowerCase()).digest("base64url").slice(0, 32);
}

export function checkUnsubscribe(email: string, sig: string) {
  const want = Buffer.from(unsubscribeSig(email));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

export function unsubscribeUrl(email: string, oneClick = false) {
  const e = email.toLowerCase();
  return `https://${ROOT_DOMAIN}${oneClick ? "/api/unsubscribe" : "/unsubscribe"}?e=${encodeURIComponent(e)}&s=${unsubscribeSig(e)}`;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Blank lines make paragraphs, "# " a heading, "- " a list, **bold**, [text](https://link). */
export function newsletterHtml(body: string, email: string | null) {
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:#0f7a5a">$1</a>');
  const blocks = body
    .trim()
    .split(/\n{2,}/)
    .map((b) => {
      const lines = b.split("\n");
      if (lines.every((l) => /^\s*[-*] /.test(l)))
        return `<ul style="padding-left:20px;margin:0 0 16px">${lines.map((l) => `<li style="margin:4px 0">${inline(l.replace(/^\s*[-*] /, ""))}</li>`).join("")}</ul>`;
      if (b.startsWith("# ")) return `<h2 style="font-family:Georgia,serif;font-weight:500;font-size:22px;margin:24px 0 8px">${inline(b.slice(2))}</h2>`;
      return `<p style="margin:0 0 16px">${lines.map(inline).join("<br>")}</p>`;
    })
    .join("");
  const foot = email
    ? `<p style="font-size:12px;color:#8a8f98;margin-top:32px;border-top:1px solid #eee;padding-top:16px">You're getting this because you run a wedding site on ${SITE_NAME}. <a href="${unsubscribeUrl(email)}" style="color:#8a8f98">Stop these emails</a>.</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f5f2"><div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1c1f24;background:#fff">${blocks}${foot}</div></body></html>`;
}
