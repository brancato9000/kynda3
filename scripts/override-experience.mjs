#!/usr/bin/env node
// Curated Experience-it primary link (V3-65): replace a card's default
// first destination with a better one (an artist's own repertory page
// beats a flaky archive search). Lives on the stored card; the UI's
// experienceLinks() honors it everywhere the card renders.
//
//   node scripts/override-experience.mjs "<subject>" "<title fragment>" <url> [label...]
//   node scripts/override-experience.mjs --clear "<subject>" "<title fragment>"

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

const args = process.argv.slice(2);
const clear = args[0] === "--clear";
if (clear) args.shift();
const [subjectName, titleFrag, url, ...labelParts] = args;
if (!subjectName || !titleFrag || (!clear && !/^https?:\/\//.test(url || ""))) {
  console.error('usage: override-experience.mjs "<subject>" "<title fragment>" <https url> [label...] | --clear "<subject>" "<title fragment>"');
  process.exit(1);
}

const row = (await q(`
  SELECT m.id, m.payload FROM mixes m JOIN entities e ON e.id = m.subject_entity_id
  WHERE lower(e.name) = lower($1) ORDER BY m.created_at DESC LIMIT 1`, [subjectName])).rows[0];
if (!row) { console.error(`no mix for "${subjectName}"`); process.exit(1); }

const hits = [];
for (const slot of row.payload.slots || []) {
  for (const c of slot.candidates || []) {
    if (c?.item?.title?.toLowerCase().includes(titleFrag.toLowerCase())) hits.push({ slot: slot.slotType, c });
  }
}
if (hits.length !== 1) {
  console.error(hits.length ? `"${titleFrag}" is ambiguous:` : `no card matching "${titleFrag}"`);
  for (const h of hits) console.error(`  [${h.slot}] ${h.c.item.title}`);
  process.exit(1);
}

const { item } = hits[0].c;
if (clear) {
  delete item.experienceUrl;
  delete item.experienceLabel;
  console.log(`cleared curated link on "${item.title}"`);
} else {
  item.experienceUrl = url;
  if (labelParts.length) item.experienceLabel = labelParts.join(" ");
  console.log(`"${item.title}" primary experience link → ${url}${item.experienceLabel ? ` ("${item.experienceLabel}")` : ""}`);
}
await q("UPDATE mixes SET payload = $2 WHERE id = $1", [row.id, JSON.stringify(row.payload)]);
await getPool().end();
