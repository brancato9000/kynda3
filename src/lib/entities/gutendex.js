// Gutendex — Project Gutenberg's free JSON API (V3-48). The public-domain
// backstop for the literature verifier: nearly every classical and
// philosophical text that trips Open Library's edition-literal matching is
// in Gutenberg under a canonical title. No key, no model calls. A hit also
// makes a perfect experience link: read the actual text, free and legal.

import { fetchWithRetry } from "./net.js";

/** Verify a title+author pair against Project Gutenberg. Award-only by
 * nature (a PD-catalog miss says nothing about post-1928 works). */
export async function verifyGutenberg(title, creator) {
  const { norm } = await import("./musicbrainz.js");
  const url = `https://gutendex.com/books?search=${encodeURIComponent(`${title} ${creator}`)}`;
  const res = await fetchWithRetry(url, { headers: { "User-Agent": "Kynda/3.0 (brancato@gmail.com)" } });
  if (!res.ok) throw new Error(`gutendex ${res.status}`);
  const data = await res.json();
  const strip = (s) => s.replace(/^(the|a|an)\s+/, "");
  const nTitle = strip(norm(title));
  const creatorTokens = norm(creator).split(" ").filter((t) => t.length > 2);
  for (const book of (data.results || []).slice(0, 10)) {
    const bt = strip(norm(book.title));
    // Gutenberg titles often append subtitles ("The Republic — Complete").
    if (bt !== nTitle && !bt.startsWith(nTitle) && !nTitle.startsWith(bt)) continue;
    const authors = (book.authors || []).map((a) => norm(a.name)); // "plato" / "homer" / "voltaire" or "last first"
    const hit = authors.some((a) => creatorTokens.every((t) => a.includes(t)) || a.split(" ").every((t) => norm(creator).includes(t)));
    if (hit) {
      return {
        verified: true,
        url: `https://www.gutenberg.org/ebooks/${book.id}`,
        title: book.title,
      };
    }
  }
  return { verified: false };
}
