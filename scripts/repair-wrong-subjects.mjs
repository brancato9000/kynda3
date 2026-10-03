#!/usr/bin/env node
// One-off repair (2026-10-02): maps that landed on the wrong subject because
// short names resolved to the wrong database item. Tony's calls: remove the
// Psycho punk-band map (and reject its links), the Lucile Watson, Jesus of
// Nazareth (1977 miniseries) and John Meyer maps; fix Phoebe Waller-Bridge's
// record and the Fargo film's creator. Every touched row is written to
// data/repairs/ first, so this can be undone by hand.
//
//   node scripts/repair-wrong-subjects.mjs            (dry run)
//   node scripts/repair-wrong-subjects.mjs --apply

import { readFileSync, writeFileSync } from "node:fs";
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
const APPLY = process.argv.includes("--apply");

const PSYCHO_BAND = "8ec211a1-717c-4455-861a-b87daf43e3ce";
const REMOVE_MAPS = [PSYCHO_BAND,
  "4d5d6043-195f-4e22-9ec3-30a170c00193", // Lucile Watson (roster meant Lady Duff-Gordon)
  "1fad88f5-8d90-4268-bccd-cf636e3617b6", // Jesus of Nazareth, 1977 miniseries (roster meant Jesus)
  "650788f5-5b9f-49ba-8d73-06da4dabc807", // John Meyer (typo search for John Mayer)
];
const PHOEBE = "bcb9e3ae-aed1-493f-b0cc-b75c4650bb89";
const FARGO_FILM = "972c42f4-55b2-415d-bb73-7b4cb38c8558";

const mixes = (await q("SELECT * FROM mixes WHERE subject_entity_id = ANY($1::uuid[])", [REMOVE_MAPS])).rows;
const claims = (await q(
  `SELECT c.* FROM claims c WHERE (c.subject_id = $1 OR c.object_id = $1)
     AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.claim_id = c.id AND r.status = 'rejected')`, [PSYCHO_BAND])).rows;
const entities = (await q("SELECT * FROM entities WHERE id = ANY($1::uuid[])", [[...REMOVE_MAPS, PHOEBE, FARGO_FILM]])).rows;

console.log(`maps to delete: ${mixes.length}; Psycho-band links to reject: ${claims.length}; records to fix: 2`);
const backup = path.join(ROOT, "data/repairs/2026-10-02-wrong-subjects-backup.json");
writeFileSync(backup, JSON.stringify({ mixes, claims, entities }, null, 1));
console.log(`backup → ${path.relative(ROOT, backup)}`);
if (!APPLY) { console.log("dry run; --apply to write"); await getPool().end(); process.exit(0); }

const client = await getPool().connect();
try {
  await client.query("BEGIN");
  await client.query("DELETE FROM mixes WHERE subject_entity_id = ANY($1::uuid[])", [REMOVE_MAPS]);
  await client.query(
    `INSERT INTO reviews (claim_id, status, perspective, reviewer, notes)
     SELECT unnest($1::uuid[]), 'rejected', 'editorial', 'Kynda audit (2026-10-02)',
            'Wrong subject: the Movies roster meant Hitchcock''s Psycho; this map was of an early-1980s Boston punk band.'`,
    [claims.map((c) => c.id)]);
  await client.query("UPDATE entities SET wikidata_qid = 'Q16224046', domain = 'television', updated_at = now() WHERE id = $1", [PHOEBE]);
  await client.query(`UPDATE entities SET metadata = metadata || '{"creator":"Joel and Ethan Coen"}'::jsonb, updated_at = now() WHERE id = $1`, [FARGO_FILM]);
  await client.query("COMMIT");
  console.log("applied.");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  client.release();
  await getPool().end();
}
