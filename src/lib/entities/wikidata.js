// Wikidata client — the cross-domain entity spine (CC0).
// Used for film/TV/literature/art resolution until TMDb/Open Library
// clients land in Phase 1. Deterministic path: no model calls.

import { fetchWithRetry } from "./net.js";

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

// Creator-shaped Wikidata properties (V3-48): authorship modeled as typed
// entity links, not description prose. This is what makes the check strong
// enough to CONVICT when a found work names a different creator.
const CREATOR_PROPS = {
  P50: "author", P170: "creator", P84: "architect", P57: "director",
  P58: "screenwriter", P86: "composer", P110: "illustrator",
  P287: "designed by", P1809: "choreographer",
};

/** Token equality with Latinization tolerance (the Andreae lesson): exact,
 * or one token a prefix of the other with at least five shared characters —
 * "johann"/"johannes", "valentin"/"valentinus". Five keeps "will"/"willa"
 * apart. */
const tokenMatches = (a, b) =>
  a === b || (Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a)));

/** Loose-but-honest name equality: exact normalized match, or every token of
 * the shorter name matching one in the longer ("Picasso" ≈ "Pablo Picasso",
 * "Johann Valentin Andreae" ≈ "Johannes Valentinus Andreae"). */
export function creatorNameMatches(a, b, norm) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  const longTokens = long.split(" ");
  return short.split(" ").every((t) => longTokens.some((lt) => tokenMatches(t, lt)));
}

/**
 * Entity-property attribution check (V3-48): find the WORK on Wikidata and
 * read its creator-shaped claims. Three verdicts:
 *   { verified: true, qid, property }          — creator entity matches
 *   { found: true, actualCreators: [...] }     — work found, creator differs → caller convicts
 *   { found: false }                            — work absent → caller stays award-only
 */
const stripArticle = (s) => String(s || "").replace(/^(the|a|an)\s+/i, "");

export async function verifyWorkByCreatorProperty(title, creator, mediumKeywords = null) {
  const { norm } = await import("./musicbrainz.js");
  // Generic titles ("Republic") drown among homonyms; try the title as
  // given, then the article-stripped/article-added variant.
  let candidates = await searchEntity(title, 10);
  const variant = stripArticle(title) === title ? `The ${title}` : stripArticle(title);
  if (variant.toLowerCase() !== title.toLowerCase()) {
    const more = await searchEntity(variant, 6);
    const seen = new Set(candidates.map((c) => c.qid));
    candidates = candidates.concat(more.filter((c) => !seen.has(c.qid)));
  }
  if (!candidates.length) return { found: false };

  const entities = await rateLimited(async () => {
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.searchParams.set("action", "wbgetentities");
    url.searchParams.set("ids", candidates.map((c) => c.qid).join("|"));
    url.searchParams.set("props", "claims");
    url.searchParams.set("format", "json");
    const res = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`Wikidata ${res.status}`);
    return (await res.json()).entities || {};
  });

  // Gather creator-property target QIDs per candidate work.
  const perWork = [];
  const allTargets = new Set();
  for (const c of candidates) {
    const claims = entities[c.qid]?.claims || {};
    const targets = [];
    for (const [prop, label] of Object.entries(CREATOR_PROPS)) {
      for (const cl of claims[prop] || []) {
        const qid = cl.mainsnak?.datavalue?.value?.id;
        if (qid) { targets.push({ qid, prop, propLabel: label }); allTargets.add(qid); }
      }
    }
    if (targets.length) perWork.push({ work: c, targets });
  }
  if (!perWork.length) return { found: false };

  // Labels AND aliases (the Andreae lesson): Wikidata's canonical label may
  // be the Latinized form ("Johannes Valentinus Andreae") while the world
  // writes "Johann Valentin Andreae" — the aliases carry the variants, so a
  // claim matching ANY of them verifies.
  const labels = await rateLimited(async () => {
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.searchParams.set("action", "wbgetentities");
    url.searchParams.set("ids", [...allTargets].slice(0, 50).join("|"));
    url.searchParams.set("props", "labels|aliases");
    url.searchParams.set("languages", "en");
    url.searchParams.set("format", "json");
    const res = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`Wikidata ${res.status}`);
    const data = (await res.json()).entities || {};
    return Object.fromEntries(Object.entries(data).map(([qid, e]) => {
      const label = e.labels?.en?.value || null;
      const aliases = (e.aliases?.en || []).map((a) => a.value).filter(Boolean);
      return [qid, label ? { label, names: [label, ...aliases] } : null];
    }));
  });

  for (const { work, targets } of perWork) {
    for (const t of targets) {
      const entry = labels[t.qid];
      if (entry && entry.names.some((n) => creatorNameMatches(creator, n, norm))) {
        return {
          verified: true, qid: work.qid,
          url: `https://www.wikidata.org/wiki/${work.qid}`,
          property: t.propLabel, creatorLabel: entry.label,
          description: work.description,
        };
      }
    }
  }
  // CONVICTION requires medium context (the Revelations/Ailey lesson): a
  // homonym pool full of other-medium works proves nothing about this one.
  // Only candidates whose description matches the medium may convict; if
  // none do, the work is simply absent → award-only.
  const convictable = mediumKeywords
    ? perWork.filter(({ work }) => {
        const d = norm(work.description || "");
        return d && mediumKeywords.some((k) => d.includes(k));
      })
    : perWork;
  if (!convictable.length) return { found: false };
  // A near-name is never a different person (the Andreae lesson): if the
  // claimed creator's surname matches a token of ANY credited name, this is
  // a spelling/Latinization gap, not a misattribution — award-only, never
  // convict. Moby-Dick/"Dickens" still convicts: dickens ≠ melville.
  const claimedTokens = norm(creator).split(" ").filter(Boolean);
  const surname = claimedTokens[claimedTokens.length - 1];
  const near = surname && convictable.flatMap(({ targets }) => targets.map((t) => labels[t.qid]))
    .filter(Boolean)
    .find((entry) => entry.names.some((n) => norm(n).split(" ").some((t) => tokenMatches(surname, t))));
  if (near) return { found: false, nearMatch: near.label };
  const actualCreators = [...new Set(convictable.flatMap(({ targets }) => targets.map((t) => labels[t.qid]?.label)).filter(Boolean))].slice(0, 4);
  return { found: true, actualCreators, qid: convictable[0].work.qid };
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
    const res = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`Wikidata ${res.status}`);
    const data = await res.json();
    return (data.search || []).map((e) => ({
      qid: e.id,
      label: e.label || null,
      description: e.description || null,
    }));
  });
}
