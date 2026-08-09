#!/usr/bin/env node
// Curated card image from Wikimedia Commons (inline media v0.5, 2026-08-08).
// Commons is the IMAGE analog of official embeds, but better: the content
// itself is openly licensed, so we render it directly — license and
// attribution come from the SAME API call as the pixels, which makes the
// rights check deterministic (V3-02 ethic: no judgment, an allowlist).
// Only files whose Commons license is in the allowlist are ever stored;
// everything else is refused here, at curation time.
//
//   node scripts/override-image.mjs "<subject>" "<title fragment>" "<Commons file title or URL>"
//   node scripts/override-image.mjs --clear "<subject>" "<title fragment>"

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

const LICENSE_ALLOWLIST = /^(public domain|pd|cc0|cc[ -]by(-sa)?([ -]\d(\.\d)?)?)/i;

const args = process.argv.slice(2);
const clear = args[0] === "--clear";
if (clear) args.shift();
const [subjectName, titleFrag, fileArg] = args;
if (!subjectName || !titleFrag || (!clear && !fileArg)) {
  console.error('usage: override-image.mjs "<subject>" "<title fragment>" "<Commons File:... or URL>" | --clear "<subject>" "<title fragment>"');
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
  delete item.imageUrl; delete item.imagePage; delete item.imageLicense; delete item.imageCredit;
  console.log(`cleared curated image on "${item.title}"`);
} else {
  // Accept a bare file title, "File:...", or a full Commons URL.
  let fileTitle = decodeURIComponent(fileArg).replace(/^https?:\/\/commons\.wikimedia\.org\/wiki\//, "").replace(/_/g, " ");
  if (!/^File:/i.test(fileTitle)) fileTitle = `File:${fileTitle}`;

  const u = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=960&format=json`;
  const d = await (await fetch(u, { headers: { "User-Agent": "Kynda/3.0 (brancato@gmail.com)" } })).json();
  const page = Object.values(d.query?.pages || {})[0];
  const ii = page?.imageinfo?.[0];
  if (!ii) { console.error(`Commons has no file "${fileTitle}"`); process.exit(1); }

  const license = ii.extmetadata?.LicenseShortName?.value || "";
  if (!LICENSE_ALLOWLIST.test(license)) {
    console.error(`REFUSED: license "${license}" is not in the allowlist (PD / CC0 / CC BY / CC BY-SA). Link it as a door instead.`);
    process.exit(1);
  }
  const credit = (ii.extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, "").trim() || "Wikimedia Commons";

  item.imageUrl = ii.thumburl || ii.url;
  item.imagePage = ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(fileTitle)}`;
  item.imageLicense = license;
  item.imageCredit = credit.slice(0, 120);
  console.log(`"${item.title}" image → ${fileTitle}`);
  console.log(`  license: ${license} | credit: ${item.imageCredit}`);
}

await q("UPDATE mixes SET payload = $2 WHERE id = $1", [row.id, JSON.stringify(row.payload)]);
await getPool().end();
