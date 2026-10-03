// Own-work check for artistless citations (Tony, 2026-10-02): when the
// reader cites a work without naming its maker, the creator comparison in
// isOwnWorkInfluence has nothing to compare — Bowie → Let's Dance reached
// the map that way. Wikidata records who made what, so a subject's own
// works are one SPARQL query away (performer, author, director, creator,
// composer, architect, screenwriter, lyricist, producer, …). Zero model
// calls. Fails open: if Wikidata is unreachable the claim is kept, and the
// sweep (scripts/experiments/reject-creatorless-self-influence.mjs) remains
// the backstop.

const PROPS = "wdt:P175|wdt:P50|wdt:P57|wdt:P170|wdt:P86|wdt:P84|wdt:P58|wdt:P676|wdt:P1431|wdt:P162|wdt:P87|wdt:P286";
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/^(the|a|an) /, "").replace(/[^a-z0-9]+/g, "");
const cache = new Map(); // qid → Promise<Set<normalized title>>

// 21 mapped music acts carry a MusicBrainz ID but no Wikidata ID (Radiohead,
// Talking Heads, Kraftwerk…); Wikidata finds them by MusicBrainz ID (P434).
function ownWorkTitles({ qid = null, mbid = null }) {
  const byQid = /^Q\d+$/.test(qid || "");
  const byMbid = !byQid && /^[0-9a-f-]{36}$/i.test(mbid || "");
  if (!byQid && !byMbid) return Promise.resolve(null);
  const key = byQid ? qid : `mb:${mbid}`;
  if (!cache.has(key)) {
    const maker = byQid ? `wd:${qid}` : "?a";
    const anchor = byQid ? "" : `?a wdt:P434 "${mbid.toLowerCase()}" . `;
    const sparql = `SELECT ?label WHERE { ${anchor}?w ${PROPS} ${maker} . ?w rdfs:label ?label . FILTER(lang(?label) = "en") }`;
    cache.set(key, fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, {
      headers: { "User-Agent": "Kynda/3.0 (brancato@gmail.com)", Accept: "application/sparql-results+json" },
      signal: AbortSignal.timeout(10_000),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`sparql ${r.status}`))))
      .then((j) => new Set(j.results.bindings.map((b) => norm(b.label.value))))
      .catch(() => { cache.delete(key); return null; }));
  }
  return cache.get(key);
}

/** True when Wikidata lists `title` among the works made by this entity (by QID, else MusicBrainz ID). */
export async function isOwnWorkByWikidata({ qid = null, mbid = null }, title) {
  const titles = await ownWorkTitles({ qid, mbid });
  return !!titles && titles.has(norm(title));
}

export { norm as normWorkTitle };
