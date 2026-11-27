import { SITE_URL } from "@/lib/commercial/pricing";

const PAGES = [
  { path: "/", priority: "1.0" },
  { path: "/start", priority: "0.8" },
  { path: "/privacy", priority: "0.3" },
  { path: "/terms", priority: "0.3" },
  { path: "/cookies", priority: "0.2" },
];

export function GET() {
  const urls = PAGES.map(
    (p) => `  <url><loc>${SITE_URL}${p.path === "/" ? "" : p.path}</loc><changefreq>weekly</changefreq><priority>${p.priority}</priority></url>`
  ).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
