// Research orchestrator (MASTERPLAN Phase B): drain the queue —
// agent proposes findings, the deterministic evidence worker gates them,
// only quote-confirmed evidence earns T2 provenance.

import { researchSubject } from "../ai/researcher.js";
import { researchSubjectOpen } from "../ai/researcher-open.js";
import { RESEARCHER } from "../ai/anthropic.js";
import { verifyEvidence } from "../verify/evidence.js";
import { getIntroExtract } from "../entities/wikipedia.js";
import { nextQueuedSubjects, markResearch, getClaimTargets, recordFinding } from "../store.js";

export async function researchOne(entity, { log = console.log, model = RESEARCHER() } = {}) {
  const runId = `run_${Date.now().toString(36)}`;
  const targets = await getClaimTargets(entity.id);
  const bio = await getIntroExtract({ name: entity.name, qid: entity.wikidata_qid }).catch(() => null);
  log(`  researching "${entity.name}" (${targets.length} known connections${model ? `, model ${model}` : ""})…`);

  // OpenRouter models ("/" in the id) run on Kynda's own search+fetch
  // harness; Claude models keep Anthropic's server-side web tools.
  const subject = { name: entity.name, domain: entity.domain, bio: bio ? { text: bio.text } : null };
  const { findings = [] } = model.includes("/")
    ? await researchSubjectOpen(subject, targets, { model })
    : await researchSubject(subject, targets, { model });
  log(`  agent returned ${findings.length} finding(s); verifying evidence…`);

  const results = { confirmed: 0, rejected: 0 };
  for (const finding of findings) {
    if (!finding.sourceUrl || !finding.quote) continue;
    const verification = await verifyEvidence({ url: finding.sourceUrl, quote: finding.quote });
    const stored = await recordFinding({ subjectEntityId: entity.id, finding, verification, runId });
    const ok = verification.status === "quote_confirmed";
    results[ok ? "confirmed" : "rejected"] += 1;
    log(`    ${ok ? "✓ T2" : `✗ ${verification.status}`}  ${finding.targetTitle} — ${finding.publication || finding.sourceUrl}${stored ? "" : " (not stored)"}`);
  }
  return results;
}

export async function runResearchBatch(limit = 3, { log = console.log, model = RESEARCHER() } = {}) {
  const queue = await nextQueuedSubjects(limit);
  if (!queue.length) {
    log("research queue is empty");
    return { subjects: 0, confirmed: 0, rejected: 0 };
  }
  const totals = { subjects: 0, confirmed: 0, rejected: 0 };
  for (const entity of queue) {
    await markResearch(entity.queue_id, "running").catch(() => {});
    try {
      const r = await researchOne(entity, { log, model });
      totals.subjects += 1;
      totals.confirmed += r.confirmed;
      totals.rejected += r.rejected;
      await markResearch(entity.queue_id, "done").catch(() => {});
    } catch (err) {
      log(`  ✗ research failed for "${entity.name}": ${err.message}`);
      // Best-effort: the queue-status write must never mask the real error.
      await markResearch(entity.queue_id, "failed", err.message.slice(0, 500)).catch(() => {});
    }
  }
  return totals;
}

// Interview hunting only where interviews plausibly exist (V3-87, Tony
// 2026-10-02): practices/concepts, foods and other non-creator subjects, and
// anyone or anything whose life or making ended before 1900 return almost
// nothing at ~$0.18 a hunt. Unknown years hunt (fail open).
const PRE_INTERVIEW_YEAR = 1900;
export function interviewsLikely(entity, wikidataYears = {}) {
  // New subjects sit at kind "other" until classify-entities runs, so a
  // person is recognized by Wikidata's "instance of: human" instead.
  if (entity.kind === "concept") return { hunt: false, why: "concept" };
  if (entity.kind === "other" && !wikidataYears.human) return { hunt: false, why: "not a person or work" };
  const kind = entity.kind === "other" ? "person" : entity.kind;
  if (entity.domain === "food") return { hunt: false, why: "food" };
  const end = entity.year_end ?? wikidataYears.end ?? null;
  const start = entity.year_start ?? wikidataYears.start ?? null;
  if (kind === "person" && end != null && end < PRE_INTERVIEW_YEAR) return { hunt: false, why: `died ${end}` };
  if (kind !== "person" && kind !== "group" && start != null && start < PRE_INTERVIEW_YEAR) return { hunt: false, why: `made ${start}` };
  if (kind === "group" && end != null && end < PRE_INTERVIEW_YEAR) return { hunt: false, why: `ended ${end}` };
  return { hunt: true, why: "" };
}

// Life/making years straight from Wikidata, for subjects hygiene hasn't dated yet.
export async function wikidataYears(qid) {
  if (!qid) return {};
  try {
    const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, { headers: { "User-Agent": "Kynda/0.2 (brancato@gmail.com)" } });
    const claims = (await res.json()).entities?.[qid]?.claims || {};
    const year = (p) => {
      const t = claims[p]?.[0]?.mainsnak?.datavalue?.value?.time;
      return t ? parseInt(t.slice(0, t.indexOf("-", 1)), 10) : null;
    };
    const human = (claims.P31 || []).some((c) => c.mainsnak?.datavalue?.value?.id === "Q5");
    return { human, start: year("P569") ?? year("P577") ?? year("P571"), end: year("P570") ?? year("P576") };
  } catch { return {}; }
}
