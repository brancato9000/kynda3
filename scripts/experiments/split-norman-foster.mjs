#!/usr/bin/env node
// One-time correction (2026-10-02): the architect's entity (Q104898, a mapped
// subject) had absorbed three claims about Norman Foster the 1930s actor and
// later director (co-star of Loretta Young and Leila Hyams), so the
// architect's map showed Hollywood co-stars. The actor gets his own entity;
// only those three claims move. No QID is guessed.
//
//   node scripts/experiments/split-norman-foster.mjs           dry run
//   node scripts/experiments/split-norman-foster.mjs --apply   split

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

const ARCHITECT = "b19c54e2-928c-4a80-8b6a-0cf3272ce06f";
const ACTOR_CLAIMS = [
  "9a9927e5-ac3b-4ed9-8c2c-a8ba1cd2105e", // Week-End Marriage
  "11f198cc-28cc-42da-8134-ebb3ffd4a5c6", // Loretta Young
  "0470ac03-ce80-49a7-92e5-b81e4a3d188c", // Leila Hyams
];
const rows = (await q("SELECT id, subject_id, object_id, claim_type, summary FROM claims WHERE id = ANY($1::uuid[])", [ACTOR_CLAIMS])).rows;
for (const c of rows) console.log(`  ${c.claim_type}: ${c.summary}`);
if (rows.length !== 3 || rows.some((c) => c.subject_id !== ARCHITECT && c.object_id !== ARCHITECT)) {
  console.log("unexpected state — nothing changed"); await getPool().end(); process.exit(1);
}
if (APPLY) {
  const e = await q(
    `INSERT INTO entities (name, kind, domain, year_start, metadata)
     VALUES ('Norman Foster (actor and director)', 'person', 'film', 1903,
             '{"note":"American actor and director (1903–1976); split from the architect Norman Foster, 2026-10-02"}')
     RETURNING id`);
  const actor = e.rows[0].id;
  await q("UPDATE claims SET subject_id = $1, updated_at = now() WHERE id = ANY($2::uuid[]) AND subject_id = $3", [actor, ACTOR_CLAIMS, ARCHITECT]);
  await q("UPDATE claims SET object_id = $1, updated_at = now() WHERE id = ANY($2::uuid[]) AND object_id = $3", [actor, ACTOR_CLAIMS, ARCHITECT]);
  console.log(`moved 3 claims to ${actor}`);
} else console.log("dry run; --apply to split");
await getPool().end();
