// Research orchestrator (MASTERPLAN Phase B): drain the queue —
// agent proposes findings, the deterministic evidence worker gates them,
// only quote-confirmed evidence earns T2 provenance.

import { researchSubject } from "../ai/researcher.js";
import { verifyEvidence } from "../verify/evidence.js";
import { getIntroExtract } from "../entities/wikipedia.js";
import { nextQueuedSubjects, markResearch, getClaimTargets, recordFinding } from "../store.js";

export async function researchOne(entity, { log = console.log } = {}) {
  const runId = `run_${Date.now().toString(36)}`;
  const targets = await getClaimTargets(entity.id);
  const bio = await getIntroExtract({ name: entity.name, qid: entity.wikidata_qid }).catch(() => null);
  log(`  researching "${entity.name}" (${targets.length} known connections)…`);

  const { findings = [] } = await researchSubject(
    { name: entity.name, domain: entity.domain, bio: bio ? { text: bio.text } : null },
    targets
  );
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

export async function runResearchBatch(limit = 3, { log = console.log } = {}) {
  const queue = await nextQueuedSubjects(limit);
  if (!queue.length) {
    log("research queue is empty");
    return { subjects: 0, confirmed: 0, rejected: 0 };
  }
  const totals = { subjects: 0, confirmed: 0, rejected: 0 };
  for (const entity of queue) {
    await markResearch(entity.queue_id, "running");
    try {
      const r = await researchOne(entity, { log });
      totals.subjects += 1;
      totals.confirmed += r.confirmed;
      totals.rejected += r.rejected;
      await markResearch(entity.queue_id, "done");
    } catch (err) {
      log(`  ✗ research failed for "${entity.name}": ${err.message}`);
      await markResearch(entity.queue_id, "failed", err.message.slice(0, 500));
    }
  }
  return totals;
}
