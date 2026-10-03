// sitemap.xml (BACKLOG #32): the home page and every mapped subject — the
// pages worth indexing. Unmapped map stops and private subjects stay out
// (their pages carry noindex too). Rebuilt on request, so new maps appear
// as soon as they're saved.
import { listSubjects } from "../src/lib/store.js";
import { slugify } from "../src/lib/slug.js";
import { SITE_URL, isPrivateSubject } from "../src/lib/site.js";

export const dynamic = "force-dynamic";

export default async function sitemap() {
  const subjects = await listSubjects().catch(() => []);
  const seen = new Set();
  const pages = [];
  for (const s of subjects) {
    const slug = slugify(s.name);
    if (!slug || seen.has(slug) || isPrivateSubject(s.name)) continue;
    seen.add(slug);
    pages.push({ url: `${SITE_URL}/s/${slug}`, lastModified: s.mapped_at || undefined, changeFrequency: "weekly", priority: 0.8 });
  }
  return [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    ...pages,
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
