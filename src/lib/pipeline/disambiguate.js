// Retrieval-first disambiguation (V3-10).
//
// kynda2 asked the model "what did the user mean?" — the model could invent
// an entity. Here the candidate list comes from MusicBrainz and Wikidata
// search APIs; the model only RANKS real candidates by index. An entity that
// doesn't exist in a structured database cannot be selected, by construction.
// The certain/likely/ambiguous tier UX is unchanged (kynda2 AD-02).
//
// V3-15: the model no longer writes the bio or any metadata. The bio is the
// subject's Wikipedia intro, quoted verbatim with attribution; years-active
// comes from MusicBrainz life-span data; the descriptor line comes from the
// database that supplied the candidate. Haiku's only outputs are indices and
// the ambiguity tier — fields it cannot hallucinate facts into.
//
// Short, crowded names (2026-10-02): label search alone buried the famous
// item — "Psycho" returned a Boston punk band and a fly family, never
// Hitchcock's film. Wikidata retrieval now unions label search with
// full-text search (popularity-boosted), adds a category-filtered search
// when the caller knows the roster category, and shows the ranker how many
// Wikipedias cover each candidate. A roster that already knows the
// Wikidata ID skips search entirely.

import { searchArtist } from "../entities/musicbrainz.js";
import { searchEntity, searchFullText, getEntitySummaries } from "../entities/wikidata.js";
import { getIntroExtract } from "../entities/wikipedia.js";
import { callHaiku } from "../ai/anthropic.js";

const RANK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["match", "primaryIndex", "alternativeIndexes", "domain"],
  properties: {
    match: { type: "string", enum: ["certain", "likely", "ambiguous", "none"] },
    primaryIndex: { type: "integer" },
    alternativeIndexes: { type: "array", items: { type: "integer" } },
    domain: {
      type: "string",
      enum: ["music", "film", "television", "literature", "art", "design", "architecture", "theater", "dance", "fashion", "other"],
    },
  },
};

const RANK_SYSTEM = `You rank search candidates for a cultural discovery engine. The user typed a query; you receive REAL candidates retrieved from MusicBrainz (music artists) and Wikidata (all cultural domains). Your job is to decide which candidate the user most likely means.

Rules:
- You may ONLY select candidates by their index. Never describe an entity that is not in the list.
- Culture is broad: foods and culinary traditions, crafts, games, practices, and ideas are valid subjects alongside works and artists (Detroit-style pizza is a subject). Never answer "none" just because the best match isn't art.
- Prefer the most culturally prominent interpretation. A globally famous entity outranks an obscure one. "in N Wikipedias" is a prominence signal: a candidate covered by 70 language editions is far more likely meant than one with 2 or none (MusicBrainz candidates carry no count; judge them by their description).
- When the query comes from a list category ("Movies", "Fashion", "Ideas"), the user means a candidate that fits that category. A category mismatch is strong evidence against a candidate, even an exact-name match: "Psycho" from Movies is the film, not a band; "Jesus of Nazareth" from Ideas is the person, not a miniseries.
- match tiers: "certain" = one clear match, no other candidate is a plausible cultural interpretation. "likely" = one dominant match but 1-3 other candidates are real cultural works someone might mean. "ambiguous" = several candidates have meaningful cultural weight with no obvious frontrunner. "none" = no candidate plausibly matches the query.
- alternativeIndexes: other candidates a user might have meant (empty for "certain"). Never include the primaryIndex. Skip near-duplicates of the primary (the same entity appearing from both sources).
- domain: the primary candidate's cultural domain.
- If match is "none", set primaryIndex to 0 and alternativeIndexes to [].`;

// Roster category → expected domain (null = too broad to flag) and an
// optional Wikidata statement that narrows a full-text search. Keys are
// lowercased and stripped of non-letters ("TV creators" → "tvcreators").
const CATEGORY_HINTS = {
  movies: { domain: "film", statement: "P31=Q11424" },
  films: { domain: "film", statement: "P31=Q11424" },
  shows: { domain: "television", statement: "P31=Q5398426" },
  tvshows: { domain: "television", statement: "P31=Q5398426" },
  film: { domain: "film", statement: "P31=Q5" },
  directors: { domain: "film", statement: "P31=Q5" },
  tv: { domain: "television", statement: "P31=Q5" },
  tvcreators: { domain: "television", statement: "P31=Q5" },
  television: { domain: "television", statement: null },
  musicians: { domain: "music", statement: null },
  fashion: { domain: "fashion", statement: "P106=Q3501317" },
  architects: { domain: "architecture", statement: "P106=Q42973" },
  dance: { domain: "dance", statement: "P31=Q5" },
  comedy: { domain: null, statement: "P31=Q5" },
  games: { domain: null, statement: "P31=Q7889" },
  books: { domain: "literature", statement: "P31=Q7725634" },
};

export function categoryHint(category) {
  if (!category) return null;
  return CATEGORY_HINTS[String(category).toLowerCase().replace(/[^a-z]/g, "")] || { domain: null, statement: null };
}

// A resolved subject whose domain disagrees with its roster category
// ("Psycho" from Movies → a music group). Review gates flag these whatever
// the confidence tier says.
export function categoryMismatch(category, subject) {
  const hint = categoryHint(category);
  return Boolean(hint?.domain && subject?.domain && subject.domain !== hint.domain);
}

function yearsFromLifeSpan(lifeSpan) {
  if (!lifeSpan?.begin) return null;
  const start = lifeSpan.begin.slice(0, 4);
  if (lifeSpan.ended && lifeSpan.end) return `${start}–${lifeSpan.end.slice(0, 4)}`;
  return `${start}–Present`;
}

async function withBio(subject) {
  // Bio = the subject's Wikipedia intro, verbatim and attributed. Quoted,
  // never generated (V3-15). Null when no article exists — honest absence.
  const bio = await getIntroExtract({ name: subject.name, qid: subject.wikidata_qid }).catch(() => null);
  return { ...subject, bio: bio ? { text: bio.text, articleTitle: bio.title, url: bio.url, source: "Wikipedia" } : null };
}

// The roster already names the item: no search, no ranking, no guessing.
async function resolveByQid(qid, hint) {
  const item = (await getEntitySummaries([qid])).get(qid);
  if (!item) return { confidence: "none", candidates: [] };
  const subject = await withBio({
    name: item.label || qid,
    kind: "unknown",
    domain: hint?.domain || "other",
    description: item.description || "",
    yearsActive: null,
    mbid: null,
    wikidata_qid: qid,
    source: "wikidata",
  });
  return { confidence: "certain", subject, alternatives: [] };
}

// Wikidata candidates: label search ∪ full-text search ∪ category-filtered
// full-text search, deduped, each with its Wikipedia-edition count.
async function wikidataCandidates(query, hint) {
  const [byLabel, byText, byCategory] = await Promise.all([
    searchEntity(query, 6).catch(() => []),
    searchFullText(query, { limit: 6 }).catch(() => []),
    hint?.statement ? searchFullText(query, { limit: 5, statement: hint.statement }).catch(() => []) : [],
  ]);
  const qids = [...new Set([...byLabel.map((e) => e.qid), ...byCategory, ...byText])];
  const summaries = await getEntitySummaries(qids).catch(() => new Map());
  const fromLabel = new Map(byLabel.map((e) => [e.qid, e]));
  return qids
    .map((qid) => {
      const s = summaries.get(qid);
      const l = fromLabel.get(qid);
      return { qid, label: s?.label || l?.label || null, description: s?.description || l?.description || null, wikipedias: s?.wikipedias ?? null };
    })
    .filter((e) => e.label);
}

/**
 * @param {string} query
 * @param {{category?: string, qid?: string}} [opts] roster context: the list
 *   category steers retrieval and ranking; a known Wikidata ID skips both.
 */
export async function disambiguate(query, { category = null, qid = null } = {}) {
  const hint = categoryHint(category);
  if (qid && /^Q\d+$/.test(qid)) return resolveByQid(qid, hint);

  const [artists, wikidata] = await Promise.all([
    searchArtist(query, 5).catch(() => []),
    wikidataCandidates(query, hint).catch(() => []),
  ]);

  const candidates = [
    ...artists.map((a) => ({
      source: "musicbrainz",
      kind: a.type === "Person" ? "person" : "group",
      domain: "music",
      name: a.name,
      description: [a.disambiguation, a.country].filter(Boolean).join(" · "),
      yearsActive: yearsFromLifeSpan(a.lifeSpan),
      mbid: a.mbid,
      wikidata_qid: null,
    })),
    ...wikidata.map((e) => ({
      source: "wikidata",
      kind: "unknown",
      domain: "unknown",
      name: e.label,
      description: e.description || "",
      yearsActive: null,
      wikipedias: e.wikipedias,
      mbid: null,
      wikidata_qid: e.qid,
    })),
  ];

  if (candidates.length === 0) {
    return { confidence: "none", candidates: [] };
  }

  const listing = candidates
    .map((c, i) => `${i}. [${c.source}] ${c.name} — ${c.description || "no description"}${c.yearsActive ? ` (${c.yearsActive})` : ""}${c.wikipedias != null ? ` · in ${c.wikipedias} Wikipedias` : ""}`)
    .join("\n");

  const ranked = await callHaiku({
    system: RANK_SYSTEM,
    user: `Query: "${query}"${category ? `\nList category: ${category}` : ""}\n\nCandidates:\n${listing}`,
    schema: RANK_SCHEMA,
  });

  if (ranked.match === "none") {
    return { confidence: "none", candidates };
  }

  const toSubject = (idx) => {
    const c = candidates[idx];
    if (!c) return null;
    return {
      name: c.name,
      kind: c.kind,
      domain: c.domain !== "unknown" ? c.domain : ranked.domain,
      description: c.description,
      yearsActive: c.yearsActive,
      mbid: c.mbid,
      wikidata_qid: c.wikidata_qid,
      source: c.source,
    };
  };

  const primary = toSubject(ranked.primaryIndex);
  if (!primary) return { confidence: "none", candidates };

  return {
    confidence: ranked.match,
    subject: await withBio(primary),
    alternatives: ranked.alternativeIndexes
      .map(toSubject)
      .filter(Boolean)
      .filter((a) => !(a.mbid && a.mbid === primary.mbid) && !(a.wikidata_qid && a.wikidata_qid === primary.wikidata_qid)),
  };
}
