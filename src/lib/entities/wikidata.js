// Wikidata client — the cross-domain entity spine (CC0).
// Used for film/TV/literature/art resolution until TMDb/Open Library
// clients land in Phase 1. Deterministic path: no model calls.

const USER_AGENT = "Kynda/0.1 (brancato@gmail.com)";
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
 * Award-only attribution check for non-music works (film, TV, art):
 * search Wikidata for the title and look for a candidate whose description
 * names both the medium and the claimed creator (Wikidata descriptions read
 * like "1972 film directed by Francis Ford Coppola").
 *
 * IMPORTANT: this verifier AWARDS but never CONVICTS (V3-13). Description
 * matching is too weak for a miss to imply misattribution — a miss returns
 * {verified:false} and the caller must map it to "unchecked", not "failed".
 */
export async function verifyWorkByDescription(title, creator, mediumKeywords) {
  const { norm } = await import("./musicbrainz.js");
  const results = await searchEntity(title, 8);
  const creatorTokens = norm(creator).split(" ").filter((t) => t.length > 2);
  const surname = creatorTokens[creatorTokens.length - 1];
  for (const r of results) {
    const desc = norm(r.description || "");
    if (!desc) continue;
    if (!mediumKeywords.some((k) => desc.includes(k))) continue;
    if (!surname || !desc.includes(surname)) continue;
    return {
      verified: true,
      qid: r.qid,
      url: `https://www.wikidata.org/wiki/${r.qid}`,
      description: r.description,
    };
  }
  return { verified: false };
}

/**
 * Search Wikidata entities by label. Returns real candidates with QIDs and
 * descriptions — the raw material for retrieval-first disambiguation
 * (decoys included by design; see DECISIONS V3-08).
 */
export async function searchEntity(query, limit = 6) {
  return rateLimited(async () => {
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.searchParams.set("action", "wbsearchentities");
    url.searchParams.set("search", query);
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`Wikidata ${res.status}`);
    const data = await res.json();
    return (data.search || []).map((e) => ({
      qid: e.id,
      label: e.label || null,
      description: e.description || null,
    }));
  });
}
