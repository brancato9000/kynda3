#!/usr/bin/env node
// created_by backfill (V3-49): link every work entity to its creator entity
// where BOTH already exist in the graph — deterministic name match through
// the same identity-pool rules as upsertEntity, zero tokens, no new
// entities. Idempotent; re-run any time (e.g. after the sprint).
//
//   node scripts/created-by.mjs [--dry]

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* env */ }

const { q, getPool } = await import("../src/lib/db.js");
const DRY = process.argv.includes("--dry");

// Works with a creator string; matching creator entity by normalized name
// (&/and folded, person/group/other pool — same spirit as upsertEntity).
const rows = await q(`
  SELECT w.id AS work_id, w.name AS work_name, w.metadata->>'creator' AS creator_name, c.id AS creator_id, c.name AS creator_entity
  FROM entities w
  JOIN LATERAL (
    SELECT id, name FROM entities c
    WHERE c.kind IN ('person', 'group')
      AND lower(regexp_replace(c.name, '\\s+&\\s+', ' and ', 'g')) = lower(regexp_replace(w.metadata->>'creator', '\\s+&\\s+', ' and ', 'g'))
    ORDER BY (c.mbid IS NOT NULL OR c.wikidata_qid IS NOT NULL) DESC, c.created_at LIMIT 1
  ) c ON true
  WHERE w.kind = 'work' AND COALESCE(w.metadata->>'creator', '') <> ''
    AND NOT EXISTS (
      SELECT 1 FROM claims cl WHERE cl.subject_id = w.id AND cl.object_id = c.id AND cl.claim_type = 'created_by'
    )`);

console.log(`${rows.rows.length} work→creator links to create${DRY ? " (dry run)" : ""}`);
let created = 0;
for (const r of rows.rows) {
  if (DRY) { console.log(`  would link: ${r.work_name} —created_by→ ${r.creator_entity}`); continue; }
  await q(
    `INSERT INTO claims (subject_id, object_id, claim_type, slot_affinity, summary, origin, model_version, agent_run_id)
     VALUES ($1, $2, 'created_by', '{}', $3, 'structured_db', 'creator_backfill', 'created_by_backfill')`,
    [r.work_id, r.creator_id, `${r.work_name} — created by ${r.creator_entity}`]
  );
  created += 1;
}
console.log(`done: ${created} created_by claims`);
await getPool().end();
