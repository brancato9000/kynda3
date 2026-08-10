#!/usr/bin/env node
// QID backfill for WORK entities (2026-08-09, "so images widen"): works
// with a creator but no QID are invisible to the P18 image backfill. Same
// ethic as backfill-qids.mjs — a wrong QID is worse than none:
//   attach only when the Wikidata label EXACT-matches the title
//   (case/diacritic/punctuation-insensitive) AND the candidate's
//   description names the creator ("album by Miles Davis", "painting by
//   Frida Kahlo"). Anything fuzzier stays untouched.
//
//   node scripts/backfill-work-qids.mjs [--dry] [--limit N]

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

const { searchEntity } = await import("../src/lib/entities/wikidata.js");
const { q, getPool } = await import("../src/lib/db.js");
const DRY = process.argv.includes("--dry");
const limitFlag = process.argv.indexOf("--limit");
const LIMIT = limitFlag === -1 ? null : parseInt(process.argv[limitFlag + 1], 10);

const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const tokens = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().match(/[a-z0-9]{3,}/g) || [];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const rows = (await q(
  `SELECT DISTINCT e.id, e.name, e.metadata->>'creator' AS creator
   FROM entities e JOIN claims c ON e.id IN (c.subject_id, c.object_id)
   WHERE e.kind = 'work' AND e.wikidata_qid IS NULL
     AND COALESCE(e.metadata->>'creator', '') <> ''
   ORDER BY e.name ${LIMIT ? `LIMIT ${LIMIT}` : ""}`
)).rows;
console.log(`${rows.length} graph-connected works with creator, no QID${DRY ? " (dry)" : ""}`);

let attached = 0, ambiguous = 0, miss = 0;
for (const [i, r] of rows.entries()) {
  await pause(300);
  let candidates;
  try {
    candidates = await searchEntity(r.name, 6);
  } catch {
    miss += 1;
    continue;
  }
  // Exact label + creator named in description. Creator match = any
  // meaningful creator token (surnames carry the signal; "the"/"and" don't).
  const creatorToks = tokens(r.creator);
  const hits = candidates.filter(
    (c) => norm(c.label) === norm(r.name) && c.description && creatorToks.some((t) => c.description.toLowerCase().includes(t))
  );
  if (hits.length !== 1) {
    hits.length ? (ambiguous += 1) : (miss += 1);
    continue;
  }
  attached += 1;
  if (DRY) {
    if (attached <= 15) console.log(`  ${r.name} (${r.creator}) → ${hits[0].qid} "${hits[0].description.slice(0, 60)}"`);
  } else {
    // Guard against QID collisions (another entity may already own it).
    await q(
      `UPDATE entities SET wikidata_qid = $2 WHERE id = $1
       AND NOT EXISTS (SELECT 1 FROM entities WHERE wikidata_qid = $2)`,
      [r.id, hits[0].qid]
    );
  }
  if (i % 200 === 0 && i) console.log(`  ...${i}/${rows.length} (${attached} attached)`);
}
console.log(`${DRY ? "would attach" : "attached"}: ${attached} | ambiguous (skipped): ${ambiguous} | no match: ${miss}`);
await getPool().end();
