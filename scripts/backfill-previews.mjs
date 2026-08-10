#!/usr/bin/env node
// iTunes 30-second preview backfill (inline media v0.6, 2026-08-09).
// Apple's Search API is free, keyless, and returns preview URLs it
// provides explicitly for this purpose — official snippets with outbound
// credit to the store page. Deterministic identity gate (V3-02 ethic):
// the result's track AND artist must match the entity name/creator after
// normalization, or nothing is stored. Music WORK entities only.
//
//   node scripts/backfill-previews.mjs [--dry] [--limit N]

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
const limitFlag = process.argv.indexOf("--limit");
const limit = limitFlag === -1 ? null : parseInt(process.argv[limitFlag + 1], 10);

// Same normalization spirit as the quote wall: strip to comparable core.
const norm = (s) => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase()
  .replace(/\(.*?\)|\[.*?\]/g, "")   // parentheticals: "(live)", "(remastered)"
  .replace(/[^a-z0-9]/g, "");

const rows = (await q(
  `SELECT id, name, metadata->>'creator' AS creator FROM entities
   WHERE kind = 'work' AND domain = 'music'
     AND metadata->>'preview_url' IS NULL
     AND COALESCE(metadata->>'creator', '') <> ''
   ORDER BY created_at ${limit ? `LIMIT ${limit}` : ""}`
)).rows;
console.log(`${rows.length} music works to try${dry ? " (dry)" : ""} — ~${Math.ceil((rows.length * 3.4) / 60)} min at iTunes rate limits`);

let stored = 0, missed = 0, gated = 0;
for (const [i, r] of rows.entries()) {
  await pause(3400); // iTunes tolerates ~20/min
  let d;
  try {
    const u = `https://itunes.apple.com/search?term=${encodeURIComponent(`${r.name} ${r.creator}`)}&media=music&entity=song&limit=5`;
    d = await (await fetch(u, { headers: UA })).json();
  } catch {
    missed += 1;
    continue;
  }
  const hit = (d.results || []).find(
    (x) => x.previewUrl && norm(x.trackName) === norm(r.name) && (norm(x.artistName) === norm(r.creator) || norm(x.artistName).includes(norm(r.creator)) || norm(r.creator).includes(norm(x.artistName)))
  );
  if (!hit) {
    (d.results || []).length ? (gated += 1) : (missed += 1);
    continue;
  }
  stored += 1;
  if (dry) { if (stored <= 12) console.log(`  ${r.name} — ${r.creator} → ${hit.trackName} / ${hit.artistName}`); }
  else {
    await q(`UPDATE entities SET metadata = metadata || $2::jsonb WHERE id = $1`, [
      r.id,
      JSON.stringify({ preview_url: hit.previewUrl, preview_page: hit.trackViewUrl || null }),
    ]);
  }
  if (i % 50 === 0 && i) console.log(`  ...${i}/${rows.length} (${stored} stored, ${gated} gate-refused, ${missed} no result)`);
}
console.log(`${dry ? "would store" : "stored"}: ${stored} | gate-refused (results but identity mismatch): ${gated} | no results: ${missed}`);
await getPool().end();
