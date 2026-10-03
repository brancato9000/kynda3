// The build list's field is the curated one (Tony, 2026-10-03): disambiguation
// guesses a domain from its source — "music" for anything MusicBrainz knows,
// "other" for the rest — and the 2026-10-03 build saved 79 of its first 160
// subjects under the wrong field (Picasso, Edward Hopper, John Ford as music).
// After a map is saved, the roster category is pinned as the entity's
// domain_override, which hygiene scripts never overwrite (V3-53).
import { q } from "../db.js";

const FIELDS = new Set(["music", "film", "television", "literature", "art", "design", "architecture", "theater", "dance", "fashion", "comedy", "other"]);
// Roster categories that aren't field names yet (new fields file under "ideas"
// until they get their own labels — BACKLOG #29).
const ALIASES = {
  movies: "film", tv: "television", books: "literature", ideas: "other", idea: "other", institution: "other",
  business: "other", food: "other", cocktail: "other", "video game": "other", "board game": "other",
  perfume: "fashion", cars: "design", "graphic design": "design",
};

export function fieldForCategory(category) {
  const c = String(category || "").trim().toLowerCase();
  if (FIELDS.has(c)) return c;
  return ALIASES[c] || null;
}

/** Pin the roster field on a just-saved subject. Returns the field set, or null. */
export async function pinRosterField(subject, category) {
  const field = fieldForCategory(category);
  if (!field || !subject?.name) return null;
  const r = await q(
    `SELECT e.id FROM entities e
     WHERE (e.wikidata_qid = $1 AND $1 IS NOT NULL) OR (e.mbid = $2 AND $2 IS NOT NULL) OR lower(e.name) = lower($3)
     ORDER BY (e.wikidata_qid = $1) DESC NULLS LAST, (e.mbid = $2) DESC NULLS LAST,
              EXISTS (SELECT 1 FROM mixes m WHERE m.subject_entity_id = e.id) DESC
     LIMIT 1`,
    [subject.wikidata_qid || null, subject.mbid || null, subject.name]);
  if (!r.rows[0]) return null;
  await q(`UPDATE entities SET domain_override = $2, updated_at = now() WHERE id = $1 AND domain_override IS DISTINCT FROM $2`, [r.rows[0].id, field]);
  return field;
}
