#!/usr/bin/env node
// Map-image backfill (2026-10-02). For every entity on the influence map
// without a picture: apply one when identity and rights are both settled
// (see src/lib/pipeline/map-images.js), otherwise queue candidates for the
// curator (/admin/images, or the in-page admin overlay). Zero model calls.
// Busiest entities first — the ones that appear on the most maps.
//
//   node scripts/map-images.mjs [--subject "Name"] [--limit N] [--dry] [--recheck]
//     --subject  just this subject and everything on its map
//     --recheck  include entities already checked (not ones a curator settled)

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
const { findEntityImage, applyEntityImage, saveCandidates } = await import("../src/lib/pipeline/map-images.js");

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const DRY = args.includes("--dry");
const RECHECK = args.includes("--recheck");
const SUBJECT = flag("--subject");
const LIMIT = parseInt(flag("--limit") || "200", 10);

const scope = SUBJECT
  ? `WITH s AS (SELECT id FROM entities WHERE lower(name) = lower($1) ORDER BY created_at LIMIT 1),
     ents AS (SELECT id FROM s UNION
              SELECT CASE WHEN c.subject_id = s.id THEN c.object_id ELSE c.subject_id END FROM claims c, s
              WHERE c.subject_id = s.id OR c.object_id = s.id)`
  : `WITH ents AS (SELECT DISTINCT unnest(ARRAY[subject_id, object_id]) AS id FROM claims)`;
const rows = (await q(
  `${scope}
   SELECT e.id, e.kind, e.domain, e.name, e.wikidata_qid, e.metadata,
          (SELECT count(*) FROM claims c WHERE c.subject_id = e.id OR c.object_id = e.id) AS degree
   FROM entities e JOIN ents ON ents.id = e.id
   WHERE e.metadata->>'image_url' IS NULL
     AND COALESCE(e.metadata->>'image_status', '') NOT IN ('none', 'removed', 'approved')
     ${RECHECK ? "" : "AND e.metadata->>'image_checked_at' IS NULL"}
   ORDER BY degree DESC, e.name
   LIMIT ${LIMIT}`, SUBJECT ? [SUBJECT] : [])).rows;

console.log(`${rows.length} entities to look at${SUBJECT ? ` on ${SUBJECT}'s map` : ""}${DRY ? " (dry run)" : ""}`);
let applied = 0, queued = 0, nothing = 0;
for (const e of rows) {
  let r;
  try { r = await findEntityImage(e); } catch (err) { console.log(`  ! ${e.name}: ${err.message}`); continue; }
  if (r.auto) {
    applied += 1;
    console.log(`  ✓ ${e.name} — ${r.auto.source}, ${r.auto.license}${r.auto.identity ? ` (${r.auto.identity})` : ""}`);
    if (!DRY) await applyEntityImage(e.id, r.auto, "auto");
  } else if (r.candidates.length) {
    queued += 1;
    console.log(`  ? ${e.name} — ${r.candidates.length} for review`);
    if (!DRY) {
      await saveCandidates(e.id, r.candidates);
      await q(`UPDATE entities SET metadata = metadata || $2::jsonb WHERE id = $1`, [e.id, JSON.stringify({ image_checked_at: new Date().toISOString() })]);
    }
  } else {
    nothing += 1;
    console.log(`  · ${e.name} — nothing found`);
    if (!DRY) await q(`UPDATE entities SET metadata = metadata || $2::jsonb WHERE id = $1`, [e.id, JSON.stringify({ image_checked_at: new Date().toISOString() })]);
  }
}
console.log(`\napplied ${applied} · queued for review ${queued} · nothing found ${nothing}`);
await getPool().end();
