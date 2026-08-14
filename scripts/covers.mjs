#!/usr/bin/env node
// Live-cover ingest (V3-39): setlist.fm → claims store. Deterministic, zero
// model tokens. The "Covered Them" slot fills from what this banks.
//
//   node scripts/covers.mjs --subject "The Shins"    one subject (needs mbid)
//   node scripts/covers.mjs --all                    every corpus subject with an mbid
//
// Requires KYNDA_SETLISTFM_KEY in .env.local (free key: api.setlist.fm).

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

const { setlistfmConfigured, getLiveCovers } = await import("../src/lib/entities/setlistfm.js");
const { recordCoverClaim, listSubjects } = await import("../src/lib/store.js");
const { q, getPool } = await import("../src/lib/db.js");

if (!setlistfmConfigured()) {
  console.error("KYNDA_SETLISTFM_KEY missing — get a free key at https://api.setlist.fm and add it to .env.local");
  process.exit(1);
}

const TOP_N = 12; // most-performed covers per subject — the signal, not the noise
const args = process.argv.slice(2);
const runId = `covers_${Date.now().toString(36)}`;

let targets = [];
if (args[0] === "--all") {
  targets = (await listSubjects()).filter((s) => s.mbid);
} else if (args[0] === "--subject" && args[1]) {
  const r = await q("SELECT id, name, mbid FROM entities WHERE lower(name) = lower($1) AND mbid IS NOT NULL LIMIT 1", [args[1]]);
  if (!r.rows[0]) { console.error(`no entity with an mbid found for "${args[1]}"`); process.exit(1); }
  targets = r.rows;
} else {
  console.error('usage: covers.mjs --subject "Name" | --all');
  process.exit(1);
}

const { getArtistMembers } = await import("../src/lib/entities/musicbrainz.js");
const nrm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

let claims = 0;
for (const t of targets) {
  process.stdout.write(`▸ ${t.name} … `);
  try {
    // Self-cover filter (Tony's axiom, 2026-08-13): an artist performing
    // their own band's song is not a cover — Phoebe playing boygenius'
    // "Me & My Dog" was topping her covers tab. Exclude originals credited
    // to the subject or any of their MusicBrainz-associated acts.
    const ownActs = new Set([nrm(t.name)]);
    try { for (const m of await getArtistMembers(t.mbid)) ownActs.add(nrm(m.name)); } catch { /* solo */ }
    const covers = (await getLiveCovers(t.mbid)).filter((c) => !ownActs.has(nrm(c.artist)));
    const top = covers.slice(0, TOP_N);
    for (const c of top) {
      const id = await recordCoverClaim({
        subjectEntityId: t.id,
        song: c.song, artist: c.artist,
        count: c.count, firstYear: c.firstYear, lastYear: c.lastYear,
        runId,
      });
      if (id) claims += 1;
    }
    console.log(`${covers.length} distinct covers found, top ${top.length} banked`);
    if (top[0]) console.log(`    most played: “${top[0].song}” (${top[0].artist}) × ${top[0].count}`);
  } catch (err) {
    console.log(`✗ ${err.message}`);
  }
}
console.log(`\ndone: ${claims} cover claims banked (${runId})`);
await getPool().end();
