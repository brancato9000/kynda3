// Wikipedia client — documentary grounding for CONNECTIONS (V3-13).
//
// The connection check is deterministic: does the subject's Wikipedia article
// mention the recommended creator (or vice versa)? If yes, we extract the
// actual sentence and show it, linked. No model decides whether a source
// "supports" the claim — we show the reader the evidence and the reader
// judges (V3-03: the verifier stays dumb). A cross-mention is documentary
// signal, not proof of influence; the UI language reflects that.

const API = "https://en.wikipedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "Kynda/0.2 (brancato@gmail.com)";
const RATE_MS = 350;

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

async function apiFetch(base, params) {
  return rateLimited(async () => {
    const url = new URL(base);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("format", "json");
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
    return res.json();
  });
}

function articleUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/**
 * Resolve the best English Wikipedia article for an entity.
 * Prefers the exact Wikidata sitelink when a QID is known (unambiguous);
 * falls back to Wikipedia search.
 */
export async function findArticleTitle({ name, qid = null }) {
  if (qid) {
    try {
      const data = await apiFetch(WIKIDATA_API, {
        action: "wbgetentities",
        ids: qid,
        props: "sitelinks",
        sitefilter: "enwiki",
      });
      const title = data.entities?.[qid]?.sitelinks?.enwiki?.title;
      if (title) return title;
    } catch {
      // fall through to search
    }
  }
  const data = await apiFetch(API, {
    action: "query",
    list: "search",
    srsearch: name,
    srlimit: "1",
  });
  return data.query?.search?.[0]?.title || null;
}

/**
 * Fetch the plain-text extract of an article.
 * Returns { title, text, url } or null.
 */
export async function getArticle({ name, qid = null }) {
  const title = await findArticleTitle({ name, qid });
  if (!title) return null;
  const data = await apiFetch(API, {
    action: "query",
    prop: "extracts",
    explaintext: "1",
    redirects: "1",
    titles: title,
  });
  const page = Object.values(data.query?.pages || {})[0];
  if (!page?.extract) return null;
  return { title: page.title, text: page.extract, url: articleUrl(page.title) };
}

/**
 * Pure: find the first sentence in `text` that mentions `name`.
 * Case-sensitive word-boundary match — proper nouns are capitalized, which
 * keeps common-word names ("Can", "Low", "Blur") from matching prose.
 * Tries the full name, then without a leading "The ".
 * Returns { sentence } or null.
 */
export function findMention(text, name) {
  const variants = [name];
  if (/^The\s+/i.test(name)) variants.push(name.replace(/^The\s+/i, ""));
  for (const variant of variants) {
    if (variant.length < 3) continue;
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u");
    if (!re.test(text)) continue;
    const sentences = text.split(/(?<=[.!?])\s+/);
    const hit = sentences.find((s) => re.test(s));
    if (!hit) continue;
    let sentence = hit.replace(/\s+/g, " ").trim();
    if (sentence.length > 320) sentence = sentence.slice(0, 317).trimEnd() + "…";
    return { sentence };
  }
  return null;
}
