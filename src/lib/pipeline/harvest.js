// Source harvester (V3-29, MASTERPLAN Pillar II role 2) — the cost-collapse
// architecture. Read each source ONCE, extract claims for EVERY entity it
// mentions. Unlike subject research there are NO web tools and NO loops:
// we fetch the page deterministically (free), hand the text to a single
// structured-output call, and verify every quote against the very text we
// hold. Cost per citation collapses because one call feeds many entities.

import { callModel, SONNET } from "../ai/anthropic.js";
import { fetchPageText, waybackSnapshot } from "../verify/evidence.js";
import { quoteMatch } from "../verify/quoteMatch.js";
import { upsertEntity, recordFinding } from "../store.js";
import { findArticleTitle } from "../entities/wikipedia.js";
import { q, dbConfigured } from "../db.js";

const HARVEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sourceTitle", "publication", "publishedDate", "claims"],
  properties: {
    sourceTitle: { type: "string" },
    publication: { type: "string" },
    publishedDate: { type: "string" },
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["subjectName", "subjectKind", "subjectDomain", "targetTitle", "targetKind", "targetCreator", "claimType", "quote", "speaker", "sourceDegree", "note"],
        properties: {
          subjectName: { type: "string" },
          subjectKind: { type: "string", enum: ["person", "group", "work", "other"] },
          subjectDomain: { type: "string", enum: ["music", "film", "television", "literature", "art", "design", "architecture", "theater", "dance", "other"] },
          targetTitle: { type: "string" },
          targetKind: { type: "string", enum: ["work", "artist", "movement", "other"] },
          targetCreator: { type: "string" },
          claimType: {
            type: "string",
            enum: ["influenced_by", "cited_as_influence", "covers", "covered_by", "collaborated_with", "member_of", "produced_by", "same_scene", "cross_medium_influence"],
          },
          quote: { type: "string" },
          speaker: { type: "string" },
          sourceDegree: { type: "string", enum: ["first", "second", "third"] },
          note: { type: "string" },
        },
      },
    },
  },
};

const HARVEST_SYSTEM = `You extract cultural-connection claims from one source text (an interview, feature, review, or liner notes). Find EVERY explicitly stated connection between cultural entities anywhere in the text — the interviewee's influences, comparisons the writer draws, collaborations mentioned, covers, scenes, production credits.

Per claim:
- subjectName: the entity the claim is ABOUT (the artist naming an influence, the work being compared). A NAMED entity only — never a description ("the writer's take on X" is not a subject; the subject is X). subjectKind and subjectDomain describe it.
- targetTitle / targetCreator: the other end of the connection. If the target is a person or band rather than a specific work, put the name in targetTitle and leave targetCreator "".
- ENTITY SHAPE RULES (both ends): every entity must be a SPECIFIC NAMED work, artist, or movement — something with a Wikipedia-article-shaped identity. Never genres or styles ("aggro punk", "circus music"), never events or moments ("his first Grammy speech" — the entity is the person), never composite lists (one claim per entity; split "influenced by X, Y and Z" into three claims), never versions/descriptions ("the demo version of...", "the writer's description of..."). Named movements are valid using their proper name ("Dada", "Bauhaus" — not "the Dada movement"). targetKind: work | artist | movement | other — use "other" when the target fails these rules, and it will be discarded.
- Never emit a claim whose target is the subject itself or one of the subject's own works.
- claimType: "cited_as_influence" when the subject explicitly names the influence themselves; otherwise the best fit.
- quote: an EXACT verbatim excerpt (40–300 chars) from the provided text documenting this claim. It is machine-checked character-for-character against the text — any paraphrase or reconstruction fails and wastes the claim.
- speaker: WHOSE WORDS the quote is (a person, never the outlet; "" only if the prose is by an unnamed writer).
- sourceDegree: "first" if the speaker is the subject or one of its creators/direct collaborators; "second" for named critics/journalists/scholars or institutional editorial voice; "third" for fan/wiki prose.
- note: one sentence on what the quote establishes.

Extract only claims the text actually states — completeness matters, but never invent. Cap output at the 40 STRONGEST claims (most specific, best-quoted) when a page states more — a truncated response loses everything, so respect the cap. Also identify the source's publication name and publish date (YYYY-MM-DD or YYYY, "" if absent).`;

const KIND_MAP = { person: "person", group: "group", work: "work", other: "other" };

/**
 * Deterministic entity-shape gate (V3-30). Pure string logic for the
 * mechanical noise classes measured in the first harvest batch:
 *   - all-lowercase phrases are genres/styles, not named entities ("aggro punk")
 *   - 3+ commas means a composite list packed into one entity
 *   - very long names are descriptions, not identities
 * The model-side targetKind enum ("other" → discard) handles the judgment
 * cases (events, speeches, versions) this function can't see.
 */
export function validEntityShape(name) {
  const s = String(name || "").trim();
  if (s.length < 2 || s.length > 80) return false;
  if ((s.match(/,/g) || []).length >= 3) return false;
  if (/^[^a-zA-Z]+$/.test(s) && s.length <= 6) return true; // symbol titles: ">>>", "!!!", "+/-"
  if (!/[A-Z0-9À-ÞΆ-Ͽ]/.test(s)) return false; // no uppercase/digit anywhere → generic phrase
  // Known limitation (accepted): stylized all-lowercase titles with letters
  // ("www.thug.com") are rejected — rare, and re-enterable via curation.
  return true;
}

/**
 * Harvest a subject's Wikipedia page — the richest free source class
 * (V3-31). Resolves the article (QID-first), skips if that URL was already
 * harvested, then runs the standard harvest. Used by both the corpus batch
 * and harvest-on-search.
 */
export async function harvestSubjectWikipedia(subject, { model = SONNET, log = () => {} } = {}) {
  if (!dbConfigured()) return { skipped: "no database" };
  const title = await findArticleTitle({ name: subject.name, qid: subject.wikidata_qid });
  if (!title) return { skipped: "no wikipedia article" };
  const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  const already = await q(
    `SELECT 1 FROM provenance p JOIN claims c ON c.id = p.claim_id
     WHERE c.agent_run_id LIKE 'harvest%' AND p.source_url = $1 LIMIT 1`,
    [url]
  );
  if (already.rows[0]) return { skipped: "already harvested", url };
  return harvestSource(url, { model, log });
}

/**
 * Harvest one source URL. Returns a summary; claims and provenance persist
 * via the standard store path (origin agent_research, runId harvest_*).
 */
export async function harvestSource(url, { model = SONNET, log = console.log } = {}) {
  const page = await fetchPageText(url);
  if (!page.ok) return { url, error: `fetch failed (${page.status || page.error})` };
  const text = page.text.slice(0, 60_000);

  const extraction = await callModel(model, {
    system: HARVEST_SYSTEM,
    user: `Source URL: ${url}\n\nPAGE TEXT:\n${text}`,
    schema: HARVEST_SCHEMA,
    // 40-claim prompt cap × ~300 tokens/claim ≈ 12k — 16k gives headroom.
    // (Five pilot pages died at 12k with uncapped claim counts.)
    maxTokens: 16_000,
    effort: "medium",
    label: "harvest",
  });

  const archivedUrl = await waybackSnapshot(url).catch(() => null);
  const publication = extraction.publication || new URL(url).hostname.replace(/^www\./, "");
  const runId = `harvest_${Date.now().toString(36)}`;
  const summary = { url, publication, extracted: extraction.claims.length, confirmed: 0, rejected: 0, subjects: new Set() };

  summary.dropped = 0;
  for (const c of extraction.claims) {
    if (!c.subjectName || !c.targetTitle || !c.quote) continue;
    // Shape gates (V3-30): model-classified junk kinds, malformed entity
    // names on either end, and self-referential claims are dropped before
    // they touch the graph.
    const selfRef = c.targetTitle.trim().toLowerCase() === c.subjectName.trim().toLowerCase();
    if (c.targetKind === "other" || !validEntityShape(c.targetTitle) || !validEntityShape(c.subjectName) || selfRef) {
      summary.dropped += 1;
      log(`    ⊘ dropped (${c.targetKind === "other" ? "kind:other" : selfRef ? "self-reference" : "shape"}): ${c.subjectName} → ${c.targetTitle}`);
      continue;
    }
    const match = quoteMatch(text, c.quote);
    const verification = match.matched
      ? { status: "quote_confirmed", archivedUrl }
      : { status: "unverifiable", reason: match.reason };

    const subjectEntityId = await upsertEntity({
      name: c.subjectName,
      kind: KIND_MAP[c.subjectKind] || "other",
      domain: c.subjectDomain,
    });
    if (!subjectEntityId) continue;

    await recordFinding({
      subjectEntityId,
      finding: {
        targetTitle: c.targetTitle,
        targetKind: c.targetKind,
        targetCreator: c.targetCreator || "",
        claimType: c.claimType,
        sourceUrl: url,
        quote: c.quote,
        speaker: c.speaker || "",
        sourceDegree: c.sourceDegree,
        publication,
        publishedDate: extraction.publishedDate || "",
        note: c.note || "",
      },
      verification,
      runId,
    });

    const ok = verification.status === "quote_confirmed";
    summary[ok ? "confirmed" : "rejected"] += 1;
    summary.subjects.add(c.subjectName);
    log(`    ${ok ? "✓" : "✗"} ${c.subjectName} → ${c.targetTitle} [${c.claimType}] ${c.speaker ? `(${c.speaker}, ${c.sourceDegree})` : ""}`);
  }

  summary.subjects = [...summary.subjects];
  return summary;
}
