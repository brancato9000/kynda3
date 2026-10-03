#!/usr/bin/env node
// One-time correction (2026-10-02, Tony caught Bowie → Let's Dance on the map):
// self-influence claims the first sweep (reject-self-influence.mjs) missed
// because the cited work had NO creator recorded. Found by matching every
// influence claim to a creator-less work against the subject's own works in
// Wikidata (performer/author/director/creator/composer/architect/… — 5 hits),
// plus two whose own summaries say they are the subject's work. Rejected by
// review row (reversible); the works with a clear maker get it stamped so
// the map's own-work filter keeps them off that maker's map from now on.
//
//   node scripts/experiments/reject-creatorless-self-influence.mjs           dry run
//   node scripts/experiments/reject-creatorless-self-influence.mjs --apply   write
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

// [subject, work, creator to stamp or null, why]
const CASES = [
  ["David Bowie", "Let's Dance", "David Bowie", "his own 1983 album (Wikidata)"],
  ["Akira Kurosawa", "Rashomon", "Akira Kurosawa", "his own 1950 film (Wikidata)"],
  ["David Simon", "The Corner", "David Simon", "his own book and HBO series (Wikidata)"],
  ["Rembrandt", "Rembrandt's Mughal drawings", "Rembrandt", "his own drawings; the influence is Mughal miniature painting (Wikidata)"],
  ["Homer", "Homeric Hymns", null, "an attribution to Homer, not an influence (Wikidata)"],
  ["Christian Dior", "Le lit à colonnes", null, "a film he designed costumes for (claim summary)"],
  ["Billie Holiday", "Holiday on Broadway", null, "a revue she starred in (claim summary)"],
];
let rejected = 0, stamped = 0;
for (const [subj, work, creator, why] of CASES) {
  const r = await q(
    `SELECT c.id, o.id AS oid, COALESCE(o.metadata->>'creator','') AS creator FROM claims c
     JOIN entities s ON s.id = c.subject_id JOIN entities o ON o.id = c.object_id
     WHERE s.name = $1 AND o.name = $2
       AND c.claim_type IN ('influenced_by','cited_as_influence','cross_medium_influence','studied_under')
       AND NOT EXISTS (SELECT 1 FROM reviews rv WHERE rv.claim_id = c.id AND rv.status = 'rejected')`,
    [subj, work]);
  console.log(`  ${subj} → ${work}: ${r.rows.length} claim(s) — ${why}${creator ? `; stamp creator "${creator}"` : ""}`);
  if (!APPLY) continue;
  for (const row of r.rows) {
    await q(`INSERT INTO reviews (claim_id, status, perspective, reviewer, notes) VALUES ($1, 'rejected', 'editorial', 'Kynda audit (2026-10-02)', $2)`,
      [row.id, `Self-influence with no creator recorded: ${why}. Own work belongs in From the Canon, never as influence.`]);
    rejected += 1;
    if (creator && !row.creator) {
      await q(`UPDATE entities SET metadata = metadata || jsonb_build_object('creator', $2::text), updated_at = now() WHERE id = $1`, [row.oid, creator]);
      stamped += 1;
    }
  }
}
console.log(APPLY ? `rejected ${rejected}; stamped ${stamped} creators` : "dry run; --apply to write");
await getPool().end();
