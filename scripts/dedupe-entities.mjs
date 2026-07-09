#!/usr/bin/env node
// One-time entity dedupe (V3-25 open thread): consolidates duplicates created
// by the domain-mismatch upsert bug. Same lower(name)+kind groups merge into
// a keeper — but conflicting canonical IDs are a merge barrier (the two
// Nirvanas are different entities and must stay that way).
//
//   node scripts/dedupe-entities.mjs           dry run (default)
//   node scripts/dedupe-entities.mjs --apply   perform the merge

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

try {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* env */ }

const { getPool } = await import("../src/lib/db.js");
const APPLY = process.argv.includes("--apply");
const pool = getPool();
const client = await pool.connect();

function conflicts(a, b) {
  return (a.mbid && b.mbid && a.mbid !== b.mbid) || (a.wikidata_qid && b.wikidata_qid && a.wikidata_qid !== b.wikidata_qid);
}

try {
  const groups = await client.query(`
    SELECT lower(name) AS lname, kind, json_agg(json_build_object(
      'id', id, 'name', name, 'mbid', mbid, 'wikidata_qid', wikidata_qid, 'created_at', created_at)
      ORDER BY (mbid IS NOT NULL OR wikidata_qid IS NOT NULL) DESC, created_at) AS members
    FROM entities GROUP BY 1, 2 HAVING count(*) > 1`);

  let merged = 0, kept = 0, claimsDeduped = 0;
  for (const g of groups.rows) {
    const members = g.members;
    const keeper = members[0];
    const toMerge = members.slice(1).filter((m) => !conflicts(keeper, m));
    const barred = members.slice(1).filter((m) => conflicts(keeper, m));
    if (barred.length) console.log(`  ⚠ NOT merging (distinct canonical IDs): "${keeper.name}" [${g.kind}] — ${barred.length} kept separate`);
    if (!toMerge.length) continue;

    console.log(`${APPLY ? "MERGING" : "would merge"}: "${keeper.name}" [${g.kind}] ← ${toMerge.length} duplicate(s)`);
    merged += toMerge.length;
    kept += 1;
    if (!APPLY) continue;

    await client.query("BEGIN");
    try {
      for (const dupe of toMerge) {
        // Claims that would become self-referential after repointing: delete.
        await client.query(
          "DELETE FROM claims WHERE (subject_id = $1 AND object_id = $2) OR (subject_id = $2 AND object_id = $1)",
          [dupe.id, keeper.id]
        );
        await client.query("UPDATE claims SET subject_id = $2 WHERE subject_id = $1", [dupe.id, keeper.id]);
        await client.query("UPDATE claims SET object_id = $2 WHERE object_id = $1", [dupe.id, keeper.id]);
        await client.query("UPDATE mixes SET subject_entity_id = $2 WHERE subject_entity_id = $1", [dupe.id, keeper.id]);
        await client.query("UPDATE query_log SET resolved_entity_id = $2 WHERE resolved_entity_id = $1", [dupe.id, keeper.id]);
        await client.query("DELETE FROM research_queue WHERE entity_id = $1", [dupe.id]);
        await client.query("DELETE FROM entities WHERE id = $1", [dupe.id]);
      }
      // Collapse duplicate claims created by the repointing: keep the oldest,
      // repoint provenance + contributions, delete the rest.
      const dupClaims = await client.query(`
        SELECT json_agg(id ORDER BY created_at) AS ids FROM claims
        WHERE subject_id = $1 OR object_id = $1
        GROUP BY subject_id, object_id, claim_type HAVING count(*) > 1`, [keeper.id]);
      for (const row of dupClaims.rows) {
        const [keepId, ...rest] = row.ids;
        for (const dupId of rest) {
          await client.query("UPDATE provenance SET claim_id = $2 WHERE claim_id = $1", [dupId, keepId]);
          await client.query("UPDATE contributions SET claim_id = $2 WHERE claim_id = $1", [dupId, keepId]);
          await client.query("DELETE FROM claims WHERE id = $1", [dupId]);
          claimsDeduped += 1;
        }
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`  ✗ rolled back "${keeper.name}": ${err.message}`);
    }
  }
  console.log(`\n${APPLY ? "done" : "dry run"}: ${merged} duplicates ${APPLY ? "merged" : "to merge"} into ${kept} keepers${APPLY ? `, ${claimsDeduped} duplicate claims collapsed` : ""}`);
} finally {
  client.release();
  await pool.end();
}
