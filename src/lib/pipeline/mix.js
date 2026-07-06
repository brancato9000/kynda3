// KyndaMix generation + deterministic verification (V3-02, V3-11).
//
// The model proposes items but NEVER assigns confidence and NEVER cites
// sources — kynda2's self-reported "verified" badge produced the canonical
// failure (CORRECTIONS.md 2026-02-14). Here every music-domain attribution
// tuple is checked against MusicBrainz by verifyItem(); the badge is
// machine-earned or not shown. Non-music verifiers (TMDb, Open Library)
// arrive in Phase 1b; until then those items are honestly labeled inferred.

import { callFable } from "../ai/anthropic.js";
import { verifyReleaseGroup, norm } from "../entities/musicbrainz.js";

const SLOT_IDS = ["titan", "ghost", "geography", "culture", "peer", "essential", "legacy", "collaborator"];

const MIX_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intro", "items"],
  properties: {
    intro: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slotType", "title", "creator", "year", "medium", "reason"],
        properties: {
          slotType: { type: "string", enum: SLOT_IDS },
          title: { type: "string" },
          creator: { type: "string" },
          year: { type: "string" },
          medium: {
            type: "string",
            enum: ["music", "film", "television", "literature", "art", "design", "architecture", "theater", "other"],
          },
          reason: { type: "string" },
        },
      },
    },
  },
};

const MIX_SYSTEM = `You are Kynda, a contextual recommendation engine mapping the influences, connections, and legacy of works of culture.

Create a "KyndaMix": 8 connected works illuminating the influences, peers, and legacy of a given subject — one item per slot, in this order:

1. titan — The KEY influence: a foundational work or artist the subject is documented to have drawn on.
2. ghost — The HIDDEN thread: an obscure, avant-garde, or under-documented influence most people wouldn't know. The most important slot for discovery.
3. geography — LOCAL ROOTS: a connection rooted in the same city, region, or scene.
4. culture — BEYOND THE MEDIUM: an influence from OUTSIDE the subject's primary domain (if the subject is music, this must be film, literature, art, etc.). Must cross mediums.
5. peer — A contemporary working in a similar orbit during the same era.
6. essential — FROM THE CANON: a definitive work by the subject themselves (creator = the subject).
7. legacy — A successor who carries the torch and cites the subject as influence.
8. collaborator — A key creative partner (producer, co-writer, cinematographer, bandmate); recommend a work that showcases the collaboration or the partner's own craft.

Rules:
- The title must be a real work actually created by the entity in the creator field. Accuracy over impressiveness: every item you propose is automatically checked against music databases, and failed checks are shown to the user as unverified — a correct, slightly less flashy pick beats an incorrect one.
- Never place the subject's own work anywhere except the essential slot.
- Each reason: 425-475 characters of specific historical context — documented influences, collaborations, scenes, events. No generic praise. Do not claim a specific interview or source exists unless you are confident it does; describe the connection instead.
- medium: the domain of the recommended work itself (not the subject).
- intro: 2-3 sentences contextualizing the mix.
- If a connection is rumored or vibes-based, choose something better documented.`;

// In-memory cache keyed on canonical entity ID (falls back to normalized name).
// Replaced by Postgres (mixes table) when DATABASE_URL wiring lands.
const mixCache = new Map();

export function subjectCacheKey(subject) {
  return subject.mbid || subject.wikidata_qid || `name:${norm(subject.name)}`;
}

export function getCachedMix(subject) {
  return mixCache.get(subjectCacheKey(subject)) || null;
}

export function cacheMix(subject, payload) {
  mixCache.set(subjectCacheKey(subject), payload);
  if (mixCache.size > 300) mixCache.delete(mixCache.keys().next().value);
}

export async function generateMix(subject) {
  const parts = [`Create a KyndaMix for: "${subject.name}"`];
  const context = [];
  if (subject.domain && subject.domain !== "unknown") context.push(`Domain: ${subject.domain}`);
  if (subject.yearsActive) context.push(`Years: ${subject.yearsActive}`);
  if (subject.description) context.push(`Identified as: ${subject.description}`);
  if (subject.bio) context.push(`Bio: ${subject.bio}`);
  if (context.length) parts.push(`This specifically refers to:\n${context.join("\n")}`);

  const mix = await callFable({
    system: MIX_SYSTEM,
    user: parts.join("\n\n"),
    schema: MIX_SCHEMA,
    maxTokens: 8000,
  });

  // Deterministic slot-rule enforcement (AD-10) — never trust prompt compliance.
  const subjectNorm = norm(subject.name);
  mix.items = (mix.items || []).filter((item) => {
    if (item.slotType !== "essential" && norm(item.creator) === subjectNorm) return false;
    if (item.slotType === "essential" && norm(item.creator) !== subjectNorm) return false;
    return true;
  });

  return mix;
}

/**
 * Deterministic verification for one mix item. Machine-assigned status:
 *   verified  — (title, creator) confirmed as a real MusicBrainz release group
 *   not_found — checked and NOT confirmed; likely a wrong attribution
 *   skipped   — no verifier for this medium yet (Phase 1b: TMDb, Open Library)
 */
export async function verifyItem(item) {
  if (item.medium !== "music") {
    return { status: "skipped", reason: `no ${item.medium} verifier yet` };
  }
  try {
    const result = await verifyReleaseGroup(item.title, item.creator);
    if (result.verified) {
      return {
        status: "verified",
        mbid: result.mbid,
        url: `https://musicbrainz.org/release-group/${result.mbid}`,
        firstReleaseDate: result.firstReleaseDate,
        method: "musicbrainz_release_group",
      };
    }
    return { status: "not_found", candidates: result.candidates };
  } catch (err) {
    return { status: "skipped", reason: `verifier error: ${err.message}` };
  }
}
