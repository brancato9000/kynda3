#!/usr/bin/env node
// Deezer preview backfill (2026-08-11): the free second sweep for cards
// Apple couldn't identify. Deezer's API is keyless (like iTunes) and
// returns official 30-second preview MP3s. Same identity gates: exact
// normalized title match (track or album) AND artist congruence — a wrong
// preview is worse than silence. Stores preview_source: "Deezer" so the
// caption credits the right platform.
//
//   node scripts/backfill-deezer.mjs [--dry] [--limit N]

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
const limFlag = process.argv.indexOf("--limit");
const LIMIT = limFlag === -1 ? null : parseInt(process.argv[limFlag + 1], 10);

const norm = (s) => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase()
  .replace(/\(.*?\)|\[.*?\]/g, "")
  .replace(/[^a-z0-9]/g, "");
const artistOk = (a, creator) => norm(a) === norm(creator) || norm(a).includes(norm(creator)) || norm(creator).includes(norm(a));

const rows = (await q(
  `SELECT id, name, metadata->>'creator' AS creator FROM entities
   WHERE kind = 'work' AND domain = 'music'
     AND metadata->>'preview_url' IS NULL
     AND COALESCE(metadata->>'creator', '') <> ''
   ORDER BY created_at ${LIMIT ? `LIMIT ${LIMIT}` : ""}`
)).rows;
console.log(`${rows.length} Apple-missed music works to try on Deezer${dry ? " (dry)" : ""}`);

let stored = 0, gated = 0, missed = 0;
for (const [i, r] of rows.entries()) {
  await pause(350);
  let d;
  try {
    d = await (await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(`${r.name} ${r.creator}`)}&limit=8`, { headers: UA })).json();
  } catch {
    missed += 1;
    continue;
  }
  const results = d.data || [];
  // Track-title match first, then album-title (any track from that album).
  const hit = results.find((x) => x.preview && norm(x.title) === norm(r.name) && artistOk(x.artist?.name, r.creator))
    || results.find((x) => x.preview && norm(x.album?.title) === norm(r.name) && artistOk(x.artist?.name, r.creator));
  if (!hit) {
    results.length ? (gated += 1) : (missed += 1);
    continue;
  }
  stored += 1;
  const page = norm(hit.album?.title) === norm(r.name) && hit.album?.id
    ? `https://www.deezer.com/album/${hit.album.id}`
    : hit.link || `https://www.deezer.com/track/${hit.id}`;
  if (dry) { if (stored <= 12) console.log(`  ${r.name} — ${r.creator} → ${hit.title} / ${hit.artist?.name}`); }
  else {
    await q(`UPDATE entities SET metadata = metadata || $2::jsonb WHERE id = $1`, [
      r.id,
      JSON.stringify({ preview_url: hit.preview, preview_page: page, preview_source: "Deezer" }),
    ]);
  }
  if (i % 50 === 0 && i) console.log(`  ...${i}/${rows.length} (${stored} stored)`);
}
console.log(`stored: ${stored} | gate-refused: ${gated} | no results: ${missed}`);
await getPool().end();
