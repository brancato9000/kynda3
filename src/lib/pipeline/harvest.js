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
        required: ["subjectName", "subjectKind", "subjectDomain", "targetTitle", "targetCreator", "claimType", "quote", "speaker", "sourceDegree", "note"],
        properties: {
          subjectName: { type: "string" },
          subjectKind: { type: "string", enum: ["person", "group", "work", "other"] },
          subjectDomain: { type: "string", enum: ["music", "film", "television", "literature", "art", "design", "architecture", "theater", "other"] },
          targetTitle: { type: "string" },
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
- subjectName: the entity the claim is ABOUT (the artist naming an influence, the work being compared). subjectKind and subjectDomain describe it.
- targetTitle / targetCreator: the other end of the connection. If the target is a person or band rather than a specific work, put the name in targetTitle and leave targetCreator "".
- claimType: "cited_as_influence" when the subject explicitly names the influence themselves; otherwise the best fit.
- quote: an EXACT verbatim excerpt (40–300 chars) from the provided text documenting this claim. It is machine-checked character-for-character against the text — any paraphrase or reconstruction fails and wastes the claim.
- speaker: WHOSE WORDS the quote is (a person, never the outlet; "" only if the prose is by an unnamed writer).
- sourceDegree: "first" if the speaker is the subject or one of its creators/direct collaborators; "second" for named critics/journalists/scholars or institutional editorial voice; "third" for fan/wiki prose.
- note: one sentence on what the quote establishes.

Extract only claims the text actually states — completeness matters, but never invent. Also identify the source's publication name and publish date (YYYY-MM-DD or YYYY, "" if absent).`;

const KIND_MAP = { person: "person", group: "group", work: "work", other: "other" };

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
    maxTokens: 12_000,
    effort: "medium",
    label: "harvest",
  });

  const archivedUrl = await waybackSnapshot(url).catch(() => null);
  const publication = extraction.publication || new URL(url).hostname.replace(/^www\./, "");
  const runId = `harvest_${Date.now().toString(36)}`;
  const summary = { url, publication, extracted: extraction.claims.length, confirmed: 0, rejected: 0, subjects: new Set() };

  for (const c of extraction.claims) {
    if (!c.subjectName || !c.targetTitle || !c.quote) continue;
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
