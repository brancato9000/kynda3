// Retrieval-first disambiguation (V3-10).
//
// kynda2 asked the model "what did the user mean?" — the model could invent
// an entity. Here the candidate list comes from MusicBrainz and Wikidata
// search APIs; the model only RANKS real candidates by index. An entity that
// doesn't exist in a structured database cannot be selected, by construction.
// The certain/likely/ambiguous tier UX is unchanged (kynda2 AD-02).

import { searchArtist } from "../entities/musicbrainz.js";
import { searchEntity } from "../entities/wikidata.js";
import { callHaiku } from "../ai/anthropic.js";

const RANK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["match", "primaryIndex", "alternativeIndexes", "domain", "bio", "genres", "yearsActive"],
  properties: {
    match: { type: "string", enum: ["certain", "likely", "ambiguous", "none"] },
    primaryIndex: { type: "integer" },
    alternativeIndexes: { type: "array", items: { type: "integer" } },
    domain: {
      type: "string",
      enum: ["music", "film", "television", "literature", "art", "design", "architecture", "theater", "other"],
    },
    bio: { type: "string" },
    genres: { type: "array", items: { type: "string" } },
    yearsActive: { type: "string" },
  },
};

const RANK_SYSTEM = `You rank search candidates for a cultural discovery engine. The user typed a query; you receive REAL candidates retrieved from MusicBrainz (music artists) and Wikidata (all cultural domains). Your job is to decide which candidate the user most likely means.

Rules:
- You may ONLY select candidates by their index. Never describe an entity that is not in the list.
- Prefer the most culturally prominent interpretation. A globally famous entity outranks an obscure one.
- match tiers: "certain" = one clear match, no other candidate is a plausible cultural interpretation. "likely" = one dominant match but 1-3 other candidates are real cultural works someone might mean. "ambiguous" = several candidates have meaningful cultural weight with no obvious frontrunner. "none" = no candidate plausibly matches the query.
- alternativeIndexes: other candidates a user might have meant (empty for "certain"). Never include the primaryIndex. Skip near-duplicates of the primary (the same entity appearing from both sources).
- bio: 2-3 sentences on the primary's artistic significance — key works, movements, cultural impact.
- genres: up to 3. yearsActive: e.g. "1985-Present" or "1972". Use "" if unknown.
- If match is "none", set primaryIndex to 0 and the other fields to empty values.`;

export async function disambiguate(query) {
  const [artists, wikidata] = await Promise.all([
    searchArtist(query, 5).catch(() => []),
    searchEntity(query, 6).catch(() => []),
  ]);

  const candidates = [
    ...artists.map((a) => ({
      source: "musicbrainz",
      kind: a.type === "Person" ? "person" : "group",
      domain: "music",
      name: a.name,
      description: [a.disambiguation, a.country, a.lifeSpan?.begin].filter(Boolean).join(" · "),
      mbid: a.mbid,
      wikidata_qid: null,
    })),
    ...wikidata.map((e) => ({
      source: "wikidata",
      kind: "unknown",
      domain: "unknown",
      name: e.label,
      description: e.description || "",
      mbid: null,
      wikidata_qid: e.qid,
    })),
  ];

  if (candidates.length === 0) {
    return { confidence: "none", candidates: [] };
  }

  const listing = candidates
    .map((c, i) => `${i}. [${c.source}] ${c.name} — ${c.description || "no description"}`)
    .join("\n");

  const ranked = await callHaiku({
    system: RANK_SYSTEM,
    user: `Query: "${query}"\n\nCandidates:\n${listing}`,
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
      domain: c.domain !== "unknown" ? c.domain : ranked.domain,
      description: c.description,
      mbid: c.mbid,
      wikidata_qid: c.wikidata_qid,
      source: c.source,
    };
  };

  const primary = toSubject(ranked.primaryIndex);
  if (!primary) return { confidence: "none", candidates };

  return {
    confidence: ranked.match,
    subject: {
      ...primary,
      bio: ranked.bio,
      genres: ranked.genres,
      yearsActive: ranked.yearsActive,
    },
    alternatives: ranked.alternativeIndexes
      .map(toSubject)
      .filter(Boolean)
      .filter((a) => !(a.mbid && a.mbid === primary.mbid) && !(a.wikidata_qid && a.wikidata_qid === primary.wikidata_qid)),
  };
}
