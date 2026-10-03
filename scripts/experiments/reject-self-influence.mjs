#!/usr/bin/env node
// One-time correction (2026-10-02): reject influence claims in which a person
// cites a work they made themselves — Bowie → Low, Kendrick → DAMN. Tony's
// axiom: an artist appears only in their own canon, never as their own
// influence. Rejection is a review row (reversible, attributed), not a delete;
// the graph read honors it. Creatorship facts (founded, produced_by) and
// adaptations pointing back at a source author are left alone on purpose.
//
//   node scripts/experiments/reject-self-influence.mjs           dry run
//   node scripts/experiments/reject-self-influence.mjs --apply   write reviews

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
const APPLY = process.argv.includes("--apply");

const r = await q(`
  SELECT c.id, a.name AS subject, c.claim_type, b.name AS work
  FROM claims c JOIN entities a ON a.id = c.subject_id JOIN entities b ON b.id = c.object_id
  WHERE c.claim_type IN ('influenced_by','cited_as_influence','cross_medium_influence','studied_under')
    AND regexp_replace(lower(coalesce(b.metadata->>'creator','')),'[^a-z0-9]','','g') <> ''
    AND regexp_replace(lower(b.metadata->>'creator'),'[^a-z0-9]','','g') = regexp_replace(lower(a.name),'[^a-z0-9]','','g')
    AND NOT EXISTS (SELECT 1 FROM reviews rv WHERE rv.claim_id = c.id AND rv.status = 'rejected')
  ORDER BY a.name, b.name`);
for (const x of r.rows) console.log(`  ${x.subject} → ${x.work} [${x.claim_type}]`);
console.log(`${r.rows.length} self-influence claims${APPLY ? "" : " (dry run; --apply to reject)"}`);
if (APPLY && r.rows.length) {
  await q(
    `INSERT INTO reviews (claim_id, status, perspective, reviewer, notes)
     SELECT unnest($1::uuid[]), 'rejected', 'editorial', 'Kynda audit (2026-10-02)',
            'Self-influence: the subject cites its own work. Own work belongs in From the Canon, never as influence.'`,
    [r.rows.map((x) => x.id)]
  );
  console.log("rejected.");
}
await getPool().end();
