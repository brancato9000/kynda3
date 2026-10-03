// robots.txt (BACKLOG #32). Crawl the subject pages; skip the admin, the
// APIs, private listening maps, print copies, share-card shells and the
// path finder (one URL per query pair — endless thin pages).
import { SITE_URL } from "../src/lib/site.js";

export default function robots() {
  return {
    rules: [{
      userAgent: "*",
      allow: ["/", "/api/og/"],
      disallow: ["/admin", "/api/", "/listen/", "/unfurl", "/path", "/s/*/print"],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
