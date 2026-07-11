// KyndaMix generation + deterministic verification (V3-02, V3-11).
//
// The model proposes items but NEVER assigns confidence and NEVER cites
// sources — kynda2's self-reported "verified" badge produced the canonical
// failure (CORRECTIONS.md 2026-02-14). Here every music-domain attribution
// tuple is checked against MusicBrainz by verifyItem(); the badge is
// machine-earned or not shown. Non-music verifiers (TMDb, Open Library)
// arrive in Phase 1b; until then those items are honestly labeled inferred.

import { callFable } from "../ai/anthropic.js";
import { verifyReleaseGroup, getArtistMembers, norm } from "../entities/musicbrainz.js";
import { verifyWorkByDescription } from "../entities/wikidata.js";
import { verifyBook } from "../entities/openlibrary.js";
import { getArticle, findMention } from "../entities/wikipedia.js";

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
        required: ["slotType", "title", "creator", "year", "medium", "reason", "via"],
        properties: {
          slotType: { type: "string", enum: SLOT_IDS },
          title: { type: "string" },
          creator: { type: "string" },
          year: { type: "string" },
          via: { anyOf: [{ type: "string" }, { type: "null" }] },
          medium: {
            type: "string",
            enum: ["music", "film", "television", "literature", "art", "design", "architecture", "theater", "dance", "other"],
          },
          reason: { type: "string" },
        },
      },
    },
  },
};

const MIX_SYSTEM = `You are Kynda, a contextual recommendation engine mapping the influences, connections, and legacy of works of culture.

Create a "KyndaMix": 8 slots illuminating the influences, peers, and legacy of a given subject. For EACH slot provide 2 or 3 ranked candidates (strongest first) — influence is never singular, and the interface presents a carousel per slot. Every candidate is a distinct work; no work may appear twice anywhere in the mix. Slots, in this order:

1. titan — The KEY influence: a foundational work or artist the subject is documented to have drawn on.
2. ghost — The HIDDEN thread: an obscure, avant-garde, or under-documented influence most people wouldn't know. The most important slot for discovery.
3. geography — LOCAL ROOTS: a connection rooted in the same city, region, or scene.
4. culture — BEYOND THE MEDIUM: an influence from OUTSIDE the subject's primary domain (if the subject is music, this must be film, literature, art, etc.). Must cross mediums.
5. peer — A contemporary working in a similar orbit during the same era.
6. essential — FROM THE CANON: a definitive work by the subject themselves (creator = the subject).
7. legacy — A successor who carries the torch and cites the subject as influence.
8. collaborator — A key creative partner (producer, co-writer, cinematographer, bandmate); recommend a work that showcases the collaboration or the partner's own craft.

Rules:
- Emit candidates as a flat items list: all candidates for a slot consecutively, strongest first, in the slot order above.
- The title must be a real work actually created by the entity in the creator field. Accuracy over impressiveness: every candidate you propose is automatically checked against music databases, and failed checks are shown to the user as unverified — a correct, slightly less flashy pick beats an incorrect one.
- Never place the subject's own work anywhere except the essential slot.
- Each reason: 425-475 characters of specific historical context — documented influences, collaborations, scenes, events. No generic praise. Do not claim a specific interview or source exists unless you are confident it does; describe the connection instead.
- medium: the domain of the recommended work itself (not the subject).
- via: when the connection runs through an intermediate person — most often a band member's work outside the band, or a collaborator's other projects — put that person's name in via. Otherwise null. Only name a via when the intermediate link is real: both hops (subject↔via and via↔work) are machine-checked against databases and encyclopedias.
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

/**
 * Canonical member / associated-act list for the subject (MusicBrainz).
 * Feeds the mix prompt so member-level connections are deliberate, and
 * serves as hop 1 of two-hop connection verification (V3-16).
 */
export async function loadSubjectMembers(subject) {
  if (!subject.mbid) return [];
  try {
    return await getArtistMembers(subject.mbid);
  } catch {
    return [];
  }
}

export async function generateMix(subject, members = []) {
  const parts = [`Create a KyndaMix for: "${subject.name}"`];
  const context = [];
  if (subject.domain && subject.domain !== "unknown") context.push(`Domain: ${subject.domain}`);
  if (subject.yearsActive) context.push(`Years: ${subject.yearsActive}`);
  if (subject.description) context.push(`Identified as: ${subject.description}`);
  if (subject.bio?.text) context.push(`Bio (from Wikipedia): ${subject.bio.text}`);
  if (members.length) {
    context.push(`Members / associated acts (from MusicBrainz): ${members.slice(0, 15).map((m) => m.name).join(", ")}`);
  }
  if (context.length) parts.push(`This specifically refers to:\n${context.join("\n")}`);

  const mix = await callFable({
    system: MIX_SYSTEM,
    user: parts.join("\n\n"),
    schema: MIX_SCHEMA,
    maxTokens: 16_000,
  });

  // Deterministic slot-rule enforcement (AD-10) — never trust prompt compliance.
  const subjectNorm = norm(subject.name);
  const seen = new Set();
  const valid = (mix.items || []).filter((item) => {
    if (item.slotType !== "essential" && norm(item.creator) === subjectNorm) return false;
    if (item.slotType === "essential" && norm(item.creator) !== subjectNorm) return false;
    const key = `${norm(item.title)}|${norm(item.creator)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    item.reason = sanitizeReason(item.reason);
    return true;
  });

  // Group into slots (V3-19): [{ slotType, candidates: [item, ...] }], max 3
  // per slot, generation order preserved (model ranks strongest first; the
  // provenance re-rank happens after verification).
  const slots = [];
  for (const slotType of SLOT_IDS) {
    const candidates = valid.filter((i) => i.slotType === slotType).slice(0, 3);
    if (candidates.length) slots.push({ slotType, candidates });
  }
  return { intro: mix.intro, slots };
}

/**
 * Deterministic degeneration gate for reason prose (V3-23). Models under a
 * character-count constraint occasionally pad with token loops
 * ("done.yes.end.stop.done…") — one unbreakable run that also wrecks layout.
 * Pure string logic: cut at the first pathological token, trim to the last
 * complete sentence, hard-cap length.
 */
export function sanitizeReason(reason) {
  let text = String(reason || "").replace(/\s+/g, " ").trim();
  // A "word" over 45 chars with 3+ internal periods is a degeneration loop,
  // not language — cut everything from the first one onward.
  const match = text.match(/\S{46,}/);
  if (match && (match[0].match(/\./g) || []).length >= 3) {
    text = text.slice(0, match.index).trim();
  }
  if (text.length > 700) text = text.slice(0, 700);
  // Trim to the last complete sentence when we cut anything.
  if (text.length < String(reason || "").trim().length) {
    const lastEnd = Math.max(text.lastIndexOf(". "), text.lastIndexOf(".”"), text.endsWith(".") ? text.length - 1 : -1);
    if (lastEnd > 100) text = text.slice(0, lastEnd + 1);
  }
  return text;
}

/**
 * Deterministic provenance score for carousel ranking (V3-19). The default
 * candidate is the best-EVIDENCED one, not the model's first pick:
 * T2 citations dominate, then documented connections, then fact-checks;
 * failed fact-checks sink to the bottom.
 */
export function provenanceScore(verification) {
  const v = verification || {};
  let score = 0;
  // Degree-weighted citations (V3-21): the artist's own words outrank
  // critics; critics outrank fan sources; all outrank a bare cross-mention.
  for (const c of v.citations || []) {
    score += c.degree === "first" ? 120 : c.degree === "third" ? 60 : 100;
  }
  if (v.connection?.status === "documented") score += 50;
  else if (v.connection?.status === "documented_via") score += 40;
  if (v.attribution?.status === "verified") score += 30;
  else if (v.attribution?.status === "not_found") score -= 100;
  return score;
}

/** Stable candidate ordering for one slot: best evidence first. */
export function rankCandidates(verifications) {
  return verifications
    .map((v, i) => ({ i, score: provenanceScore(v) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.i);
}

// Wikidata-description keywords per medium (award-only checks, V3-13).
const WIKIDATA_KEYWORDS = {
  film: ["film", "movie"],
  television: ["television", "tv series", "series", "sitcom", "miniseries"],
  art: ["painting", "sculpture", "artwork", "photograph", "mural"],
  design: ["design", "typeface", "chair", "poster"],
  architecture: ["building", "architecture", "tower", "museum", "house"],
  theater: ["play", "musical", "opera", "ballet"],
  dance: ["ballet", "dance", "choreograph", "dancer", "dance company"],
};

/**
 * Deterministic ATTRIBUTION check: does the claimed creator actually have a
 * work with this title? Machine-assigned status:
 *   verified  — confirmed in a structured database (strong)
 *   not_found — checked by a strong verifier and NOT confirmed; likely wrong
 *   skipped   — no verifier, or an award-only verifier found no match
 *               (weak evidence either way → "unchecked" in the UI, never red)
 */
export async function verifyAttribution(item) {
  try {
    if (item.medium === "music") {
      const result = await verifyReleaseGroup(item.title, item.creator);
      if (result.verified) {
        return {
          status: "verified",
          source: "MusicBrainz",
          url: `https://musicbrainz.org/release-group/${result.mbid}`,
          detail: result.firstReleaseDate ? `first released ${result.firstReleaseDate}` : null,
          method: "musicbrainz_release_group",
        };
      }
      return { status: "not_found", source: "MusicBrainz", candidates: result.candidates };
    }

    if (item.medium === "literature") {
      const result = await verifyBook(item.title, item.creator);
      if (result.verified) {
        return {
          status: "verified",
          source: "Open Library",
          url: result.url,
          detail: result.firstPublishYear ? `first published ${result.firstPublishYear}` : null,
          method: "openlibrary_search",
        };
      }
      return { status: "not_found", source: "Open Library" };
    }

    const keywords = WIKIDATA_KEYWORDS[item.medium];
    if (keywords) {
      const result = await verifyWorkByDescription(item.title, item.creator, keywords);
      if (result.verified) {
        return {
          status: "verified",
          source: "Wikidata",
          url: result.url,
          detail: result.description,
          method: "wikidata_description",
        };
      }
      // Award-only: a Wikidata description miss is weak evidence — unchecked, not red.
      return { status: "skipped", reason: "no confident Wikidata match; this check awards but never convicts" };
    }

    return { status: "skipped", reason: `no ${item.medium} verifier yet` };
  } catch (err) {
    return { status: "skipped", reason: `verifier error: ${err.message}` };
  }
}

/**
 * Load the subject's Wikipedia article once per mix (used by every
 * connection check). Null when no article exists — checks degrade gracefully.
 */
export async function loadSubjectArticle(subject) {
  try {
    return await getArticle({ name: subject.name, qid: subject.wikidata_qid });
  } catch {
    return null;
  }
}

/**
 * Deterministic CONNECTION documentation (V3-13): does the subject's
 * Wikipedia article mention the recommended creator — or the creator's
 * article mention the subject? If yes, extract the actual sentence and link
 * it. A cross-mention is documentary signal, not proof of influence; the UI
 * presents the evidence and lets the reader judge. No model in this path.
 */
export async function verifyConnection(item, subject, subjectArticle, members = []) {
  if (item.slotType === "essential") return { status: "not_applicable" };
  try {
    if (subjectArticle) {
      const mention = findMention(subjectArticle.text, item.creator);
      if (mention) {
        return {
          status: "documented",
          articleTitle: subjectArticle.title,
          url: subjectArticle.url,
          excerpt: mention.sentence,
        };
      }
    }
    const creatorArticle = await getArticle({ name: item.creator });
    if (creatorArticle) {
      const mention = findMention(creatorArticle.text, subject.name);
      if (mention) {
        return {
          status: "documented",
          articleTitle: creatorArticle.title,
          url: creatorArticle.url,
          excerpt: mention.sentence,
        };
      }
    }
    // Two-hop path (V3-16): the model proposed an intermediate person; both
    // hops are machine-checked. ONE intermediate hop maximum, by design —
    // longer chains connect everyone to everything and the signal dies.
    if (item.via && norm(item.via) !== norm(subject.name)) {
      const viaHop = await verifyViaChain(item, subject, subjectArticle, members);
      if (viaHop) return viaHop;
    }
    return { status: "undocumented" };
  } catch {
    return { status: "undocumented" };
  }
}

async function verifyViaChain(item, subject, subjectArticle, members) {
  // Hop 1: is `via` really connected to the subject?
  // Strongest: a MusicBrainz membership relation. Fallback: subject's
  // Wikipedia article mentions them.
  let hop1 = null;
  const member = members.find((m) => norm(m.name) === norm(item.via));
  if (member) {
    hop1 = { kind: "membership", label: `member of ${subject.name}`, source: "MusicBrainz", url: member.url };
  } else if (subjectArticle) {
    const mention = findMention(subjectArticle.text, item.via);
    if (mention) {
      hop1 = { kind: "mention", articleTitle: subjectArticle.title, url: subjectArticle.url, excerpt: mention.sentence };
    }
  }
  if (!hop1) return null;

  // Hop 2: does the via person's article mention the recommended work
  // (by title, or failing that by its credited creator)?
  const viaArticle = await getArticle({ name: item.via });
  if (!viaArticle) return null;
  const mention = findMention(viaArticle.text, item.title) || findMention(viaArticle.text, item.creator);
  if (!mention) return null;

  return {
    status: "documented_via",
    via: item.via,
    hop1,
    hop2: { articleTitle: viaArticle.title, url: viaArticle.url, excerpt: mention.sentence },
  };
}
