// Ask Kynda (V3-67): the interrogative mode — born from a kid's hunch that
// Ovid's Metamorphoses shaped Percy Jackson and the wish that he "could ask
// Kynda". Given a subject and a candidate influence, run the same layers a
// mix card earns its chips from, in order of trustworthiness:
//   1. retrieval-first resolution of the candidate (no invented entities);
//   2. the claims graph — do edges already connect them?
//   3. deterministic Wikipedia cross-mention, both directions;
//   4. a structured model assessment — which can NEVER output "documented";
//      the documented status belongs to layers 2-3 alone (V3-02/V3-03).
// The model's job is the nuance: direct citation vs transmission lineage,
// and where a real receipt would live if one exists.

import { disambiguate } from "./disambiguate.js";
import { getArticle, findMention } from "../entities/wikipedia.js";
import { callFable } from "../ai/anthropic.js";
import { q, dbConfigured } from "../db.js";

const VERDICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["assessment", "reasoning", "transmission_note", "evidence_suggestions"],
  properties: {
    assessment: { type: "string", enum: ["likely", "plausible", "unlikely"] },
    reasoning: { type: "string" },
    transmission_note: { anyOf: [{ type: "string" }, { type: "null" }] },
    evidence_suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source", "rationale"],
        properties: { source: { type: "string" }, rationale: { type: "string" } },
      },
    },
  },
};

const ASK_SYSTEM = `You are Kynda, a contextual recommendation engine. A reader has a hunch that one work or artist influenced another, and machine checks have already run — their results are given to you. Your job is the honest assessment the databases cannot make:

- assessment: "likely" only when you are confident a real, documented connection exists; "plausible" when the lineage is credible but you know of no direct citation; "unlikely" when the hunch misreads history.
- reasoning: 2-4 sentences of specific history. Distinguish DIRECT influence (the subject's creator engaged with the candidate) from TRANSMISSION lineage (the candidate shaped the tradition the subject drew on). Never invent citations, interviews, or quotes.
- transmission_note: when the honest answer is "indirectly, via a tradition", name the chain in one sentence; else null.
- evidence_suggestions: up to 3 real places a receipt would live (author FAQs, named interviews, forewords, scholarly commentary). Only name sources you are confident exist.

You cannot declare a connection documented — that status is earned only by the deterministic checks. If they found nothing, say what that absence does and does not mean.`;

export async function askInfluence(subject, candidateName) {
  // 1. Resolve the candidate — retrieval-first; a hunch about something no
  // database knows stays a raw string and is assessed with that caveat.
  let d = await disambiguate(candidateName).catch(() => null);
  // Kid-phrased hunches arrive as possessives ("Ovid's Metamorphoses");
  // retry with the bare work title when the full phrase resolves nothing.
  if (!d?.subject && /\w's\s+\S/.test(candidateName)) {
    d = await disambiguate(candidateName.replace(/^.*?'s\s+/, "")).catch(() => null);
  }
  const candidate = d?.subject || null;
  const cname = candidate?.name || candidateName;
  const ccreator = candidate?.description?.match(/by (.+?)(?:\(|$)/)?.[1]?.trim() || null;

  // 2. Existing graph edges between the two, either direction, any type.
  let edges = [];
  if (dbConfigured()) {
    const r = await q(
      `SELECT c.claim_type, c.summary, s.name AS subject_name, o.name AS object_name,
              (SELECT p.quote FROM provenance p WHERE p.claim_id = c.id AND p.quote IS NOT NULL LIMIT 1) AS quote,
              (SELECT p.source_url FROM provenance p WHERE p.claim_id = c.id AND p.source_url IS NOT NULL LIMIT 1) AS url
       FROM claims c
       JOIN entities s ON s.id = c.subject_id
       JOIN entities o ON o.id = c.object_id
       WHERE (lower(s.name) = lower($1) AND o.name ILIKE $2)
          OR (lower(o.name) = lower($1) AND s.name ILIKE $2)
       LIMIT 5`,
      [subject.name, `%${cname.split(" (")[0]}%`]
    ).catch(() => ({ rows: [] }));
    edges = r.rows;
  }

  // 3. Deterministic cross-mention, both directions.
  const [subjArt, candArt] = await Promise.all([
    getArticle({ name: subject.name, qid: subject.wikidata_qid }).catch(() => null),
    getArticle({ name: cname, qid: candidate?.wikidata_qid }).catch(() => null),
  ]);
  const shortC = cname.split(" (")[0];
  const mentions = [];
  if (subjArt) {
    for (const needle of [shortC, ccreator].filter(Boolean)) {
      const hit = findMention(subjArt.text, needle);
      if (hit) { mentions.push({ direction: "subject_mentions_candidate", needle, sentence: hit.sentence, articleTitle: subjArt.title, url: subjArt.url }); break; }
    }
  }
  if (candArt) {
    const hit = findMention(candArt.text, subject.name);
    if (hit) mentions.push({ direction: "candidate_mentions_subject", needle: subject.name, sentence: hit.sentence, articleTitle: candArt.title, url: candArt.url });
  }
  const documented = edges.length > 0 || mentions.length > 0;

  // 4. Model assessment — nuance only, never the documented verdict.
  const machine = [
    `Candidate resolved: ${candidate ? `${candidate.name} (${candidate.description || candidate.kind})` : `NOT FOUND in MusicBrainz/Wikidata — assessed as the raw phrase "${candidateName}"`}.`,
    `Existing graph edges: ${edges.length ? edges.map((e) => e.summary || e.claim_type).join("; ") : "none"}.`,
    `Wikipedia cross-mention: ${mentions.length ? mentions.map((m) => `${m.articleTitle} — "${m.sentence.slice(0, 200)}"`).join(" | ") : "none found in either direction"}.`,
  ].join("\n");
  const verdict = await callFable({
    system: ASK_SYSTEM,
    user: `Subject: "${subject.name}"${subject.description ? ` (${subject.description})` : ""}, domain: ${subject.domain}.\nReader's hunch: influenced by "${candidateName}".\n\nMachine check results:\n${machine}`,
    schema: VERDICT_SCHEMA,
    maxTokens: 2000,
  });

  return {
    candidate: candidate ? { name: candidate.name, description: candidate.description || null, kind: candidate.kind } : null,
    documented,
    edges,
    mentions,
    verdict,
  };
}
