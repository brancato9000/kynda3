#!/usr/bin/env node
// Map-image backfill (2026-10-02). For every entity on the influence map
// without a picture: apply one when identity and rights are both settled
// (see src/lib/pipeline/map-images.js), otherwise queue candidates for the
// curator (/admin/images, or the in-page admin overlay). Zero model calls.
// Busiest entities first — the ones that appear on the most maps.
//
//   node scripts/map-images.mjs [--subject "Name"] [--limit N] [--shard i/n] [--dry] [--recheck]
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
const { entitiesNeedingImages, processEntityImage } = await import("../src/lib/pipeline/map-images.js");

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const DRY = args.includes("--dry");
const RECHECK = args.includes("--recheck");
const SUBJECT = flag("--subject");
const LIMIT = parseInt(flag("--limit") || "200", 10);
// --shard 0/3, 1/3, 2/3: three processes split the corpus without overlapping.
const SHARD = flag("--shard") ? flag("--shard").split("/").map(Number) : null;

const rows = await entitiesNeedingImages({ subject: SUBJECT, limit: LIMIT, recheck: RECHECK, shard: SHARD });
console.log(`${rows.length} entities to look at${SUBJECT ? ` on ${SUBJECT}'s map` : ""}${DRY ? " (dry run)" : ""}`);
let applied = 0, queued = 0, nothing = 0;
const { findEntityImage } = await import("../src/lib/pipeline/map-images.js");
for (const e of rows) {
  try {
    if (DRY) {
      const r = await findEntityImage(e);
      if (r.auto) { applied += 1; console.log(`  ✓ ${e.name} — ${r.auto.source}, ${r.auto.license}${r.auto.identity ? ` (${r.auto.identity})` : ""}`); }
      else if (r.candidates.length) { queued += 1; console.log(`  ? ${e.name} — ${r.candidates.length} for review`); }
      else { nothing += 1; console.log(`  · ${e.name} — nothing found`); }
      continue;
    }
    const r = await processEntityImage(e);
    if (r.outcome === "applied") { applied += 1; console.log(`  ✓ ${e.name} — ${r.pick.source}, ${r.pick.license}${r.pick.identity ? ` (${r.pick.identity})` : ""}`); }
    else if (r.outcome === "queued") { queued += 1; console.log(`  ? ${e.name} — ${r.count} for review`); }
    else { nothing += 1; console.log(`  · ${e.name} — nothing found`); }
  } catch (err) { console.log(`  ! ${e.name}: ${err.message}`); }
}
console.log(`\napplied ${applied} · queued for review ${queued} · nothing found ${nothing}`);
await getPool().end();
