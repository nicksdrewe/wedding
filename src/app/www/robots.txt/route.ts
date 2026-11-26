import { SITE_URL } from "@/lib/commercial/pricing";

// The commercial site welcomes search engines and AI crawlers. (Wedding sites
// say no to all of them: see app/robots.ts.)
export function GET() {
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
