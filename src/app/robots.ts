import type { MetadataRoute } from "next";

// Wedding sites are private: no search engine or AI crawler should list them.
// The commercial site has its own (app/www/robots.txt).
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
