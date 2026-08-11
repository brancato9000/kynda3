#!/usr/bin/env node
// Artist "vibe" sample (Tony, 2026-08-11): the map assumes you know the
// artist — a bio-level preview of their top track fixes the cold start.
// iTunes search results are popularity-ordered; take the first track whose
// artist matches exactly (identity gate as ever). Stored on the PERSON/
// GROUP entity as vibe_* metadata.
//
//   node scripts/backfill-vibe.mjs [--subject "Name"] [--dry] [--limit N]

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
const UA = { "User-Agent": "Kynda/3.0 (kynda3.vercel.app; brancato@gmail.com)" };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const dry = process.argv.includes("--dry");
const sFlag = process.argv.indexOf("--subject");
const ONLY = sFlag === -1 ? null : process.argv[sFlag + 1];
const lFlag = process.argv.indexOf("--limit");
const LIMIT = lFlag === -1 ? null : parseInt(process.argv[lFlag + 1], 10);

const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const rows = (await q(
  `SELECT DISTINCT e.id, e.name FROM entities e
   JOIN mixes m ON m.subject_entity_id = e.id
   WHERE e.kind IN ('person','group') AND e.domain IN ('music','comedy')
     AND e.metadata->>'vibe_url' IS NULL
     ${ONLY ? "AND lower(e.name) = lower($1)" : ""}
   ORDER BY e.name ${LIMIT ? `LIMIT ${LIMIT}` : ""}`,
  ONLY ? [ONLY] : []
)).rows;
console.log(`${rows.length} music/comedy subjects without a vibe sample${dry ? " (dry)" : ""}`);

let stored = 0, missed = 0;
for (const r of rows) {
  await pause(3400);
  let d;
  try {
    d = await (await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(r.name)}&media=music&entity=song&limit=8`, { headers: UA })).json();
  } catch { missed += 1; continue; }
  // Containment, not equality: vibe tracks often credit collaborations
  // ("Chris Thile & Brad Mehldau") — the artist is genuinely on them.
  const hit = (d.results || []).find((x) => x.previewUrl && norm(x.artistName).includes(norm(r.name)));
  if (!hit) { missed += 1; continue; }
  stored += 1;
  console.log(`  ♪ ${r.name} → "${hit.trackName}"`);
  if (!dry) {
    await q(`UPDATE entities SET metadata = metadata || $2::jsonb WHERE id = $1`, [
      r.id,
      JSON.stringify({ vibe_url: hit.previewUrl, vibe_page: hit.trackViewUrl || null, vibe_track: hit.trackName.slice(0, 80) }),
    ]);
  }
}
console.log(`stored: ${stored} | missed: ${missed}`);
await getPool().end();
