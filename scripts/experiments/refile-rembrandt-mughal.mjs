#!/usr/bin/env node
// One-time correction (2026-10-02): Rembrandt's documented influence —
// Mughal miniature painting — had been filed against "Rembrandt's Mughal
// drawings" (his own work), so the self-influence sweep rejected it. Re-file
// the same quote-confirmed evidence against the tradition itself (Q1049336).
// Same pattern as the Bowie → Metropolis link that survived in its own claim.
//
//   node scripts/experiments/refile-rembrandt-mughal.mjs [--apply]
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
try {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".env.local");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* env */ }
const { q, getPool } = await import("../../src/lib/db.js");
const { upsertEntity } = await import("../../src/lib/store.js");
const APPLY = process.argv.includes("--apply");
const OLD_CLAIM = "99cab376-5fc5-43a1-ae29-6d28fed43745";

const old = (await q(`SELECT c.subject_id, p.* FROM claims c JOIN provenance p ON p.claim_id = c.id
  WHERE c.id = $1 AND p.verification_status = 'quote_confirmed'`, [OLD_CLAIM])).rows;
console.log(`evidence rows to carry: ${old.length}`);
if (APPLY && old.length) {
  const target = await upsertEntity({ name: "Mughal painting", kind: "other", domain: "art", wikidata_qid: "Q1049336" });
  const exists = await q(`SELECT id FROM claims WHERE subject_id = $1 AND object_id = $2 AND claim_type = 'influenced_by'`, [old[0].subject_id, target]);
  const claimId = exists.rows[0]?.id || (await q(
    `INSERT INTO claims (subject_id, object_id, claim_type, slot_affinity, summary, origin, agent_run_id)
     VALUES ($1, $2, 'influenced_by', '{}', $3, 'human_curation', 'refile_2026-10-02') RETURNING id`,
    [old[0].subject_id, target, "Rembrandt drew versions of some 23 Mughal miniatures in the 1650s and may have owned an album of them."])).rows[0].id;
  for (const p of old) {
    await q(`INSERT INTO provenance (claim_id, source_url, archived_url, quote, publication, published_date, retrieved_at,
               verification_status, verification_method, verified_at, notes, speaker, source_degree)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [claimId, p.source_url, p.archived_url, p.quote, p.publication, p.published_date, p.retrieved_at,
       p.verification_status, p.verification_method, p.verified_at, "Re-filed from claim " + OLD_CLAIM + " (own-work target) to the tradition itself.", p.speaker, p.source_degree]);
  }
  console.log(`Rembrandt → Mughal painting: claim ${claimId}, ${old.length} evidence row(s)`);
}
await getPool().end();
