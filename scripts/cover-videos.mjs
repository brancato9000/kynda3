#!/usr/bin/env node
// Verified cover videos (V3-40): resolve setlist.fm cover claims to actual
// YouTube videos of the performance. Deterministic title gate; quota-aware
// (search = 100 units, 10k/day free → default cap 85 lookups per run; rerun
// tomorrow for the rest).
//
//   node scripts/cover-videos.mjs [--limit N]

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

const { youtubeConfigured, findCoverVideo } = await import("../src/lib/entities/youtube.js");
const { recordCoverVideo } = await import("../src/lib/store.js");
const { q, getPool } = await import("../src/lib/db.js");

if (!youtubeConfigured()) {
  console.error("KYNDA_YOUTUBE_KEY missing");
  process.exit(1);
}

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? parseInt(process.argv[limitArg + 1], 10) : 85;

// Most-played covers first: the play count lives in the claim summary.
const rows = (
  await q(`
    SELECT c.id, s.name AS subject, o.name AS song, c.summary
    FROM claims c
    JOIN entities s ON s.id = c.subject_id
    JOIN entities o ON o.id = c.object_id
    WHERE c.model_version = 'setlistfm'
      AND NOT EXISTS (SELECT 1 FROM provenance p WHERE p.claim_id = c.id AND p.verification_method = 'youtube_video')
  `)
).rows
  .map((r) => ({ ...r, count: parseInt((r.summary || "").match(/live (\d+) time/)?.[1] || "0", 10) }))
  .sort((a, b) => b.count - a.count)
  .slice(0, LIMIT);

console.log(`${rows.length} cover claims to resolve (cap ${LIMIT})`);
let found = 0, missed = 0;
for (const r of rows) {
  try {
    const video = await findCoverVideo(r.subject, r.song);
    if (video) {
      await recordCoverVideo(r.id, video);
      found += 1;
      console.log(`  ▶ ${r.subject} — “${r.song}”: ${video.title} [${video.channel}]`);
    } else {
      missed += 1;
      console.log(`  ⊘ ${r.subject} — “${r.song}”: no title-verified video in top 5`);
    }
    await new Promise((res) => setTimeout(res, 250));
  } catch (err) {
    console.error(`  ✗ ${r.subject} — “${r.song}”: ${err.message}`);
    if (/quota/.test(err.message)) break;
  }
}
console.log(`\ndone: ${found} verified videos attached, ${missed} without a verified match`);
await getPool().end();
