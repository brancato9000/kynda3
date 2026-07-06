// Open Library client — attribution verification for books (keyless, open).
// Same contract as the MusicBrainz tuple check: exact-ish title match with
// the claimed author present in the author credits.

import { norm } from "./musicbrainz.js";

const USER_AGENT = "Kynda/0.2 (brancato@gmail.com)";
const RATE_MS = 600;

let lastCall = 0;
let queue = Promise.resolve();

function rateLimited(fn) {
  const run = queue.then(async () => {
    const wait = lastCall + RATE_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
}

/**
 * Verify that `author` actually wrote a book titled `title`.
 * verified=true requires normalized exact title match and the claimed
 * author present in the work's author credits.
 */
export async function verifyBook(title, author) {
  return rateLimited(async () => {
    const url = new URL("https://openlibrary.org/search.json");
    url.searchParams.set("title", title);
    url.searchParams.set("author", author);
    url.searchParams.set("limit", "5");
    url.searchParams.set("fields", "key,title,author_name,first_publish_year");
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`Open Library ${res.status}`);
    const data = await res.json();

    const wantTitle = norm(title);
    const wantAuthor = norm(author);
    for (const doc of data.docs || []) {
      if (norm(doc.title) !== wantTitle) continue;
      const authors = (doc.author_name || []).map(norm);
      if (!authors.some((a) => a === wantAuthor)) continue;
      return {
        verified: true,
        url: `https://openlibrary.org${doc.key}`,
        firstPublishYear: doc.first_publish_year || null,
      };
    }
    return { verified: false };
  });
}
