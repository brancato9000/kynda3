#!/usr/bin/env node
// P18 image backfill (inline media v0.6, 2026-08-09): every entity with a
// Wikidata QID gets its P18 ("image") Commons file — the community-vetted
// canonical image — stored on entity metadata, behind the SAME license
// allowlist as override-image.mjs. Zero model calls; batched HTTP only.
// Cards pick these up at serve time (store.getCardImage) unless a curated
// override already sits on the card — curation always beats backfill.
//
//   node scripts/backfill-images.mjs [--dry] [--limit N]

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
const UA = { "User-Agent": "Kynda/3.0 (kynda3.vercel.app; brancato@gmail.com)" };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const dry = process.argv.includes("--dry");
const limitFlag = process.argv.indexOf("--limit");
const limit = limitFlag === -1 ? null : parseInt(process.argv[limitFlag + 1], 10);

const rows = (await q(
  `SELECT id, name, wikidata_qid FROM entities
   WHERE wikidata_qid IS NOT NULL AND metadata->>'image_url' IS NULL
   ORDER BY created_at ${limit ? `LIMIT ${limit}` : ""}`
)).rows;
console.log(`${rows.length} QID-bearing entities without an image${dry ? " (dry)" : ""}`);

// Phase 1: P18 filenames, batched 50 QIDs per Wikidata call.
const p18 = {}; // qid -> filename
for (let i = 0; i < rows.length; i += 50) {
  const batch = rows.slice(i, i + 50);
  const ids = [...new Set(batch.map((r) => r.wikidata_qid))].join("|");
  try {
    const d = await (await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}&props=claims&format=json`, { headers: UA })).json();
    for (const [qid, ent] of Object.entries(d.entities || {})) {
      const f = ent.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (f) p18[qid] = f;
    }
  } catch (err) {
    console.log(`  ✗ wikidata batch ${i}: ${err.message}`);
  }
  if (i % 500 === 0 && i) console.log(`  ...${i}/${rows.length} scanned, ${Object.keys(p18).length} with P18`);
  await pause(250);
}
console.log(`P18 present on ${Object.keys(p18).length}/${rows.length}`);

// Phase 2: Commons license + thumb + credit, batched 20 files per call.
const files = [...new Set(Object.values(p18))];
const info = {}; // filename -> {url, page, license, credit} | null (gate-refused)
let refused = 0;
for (let i = 0; i < files.length; i += 20) {
  const batch = files.slice(i, i + 20);
  const titles = batch.map((f) => `File:${f}`).join("|");
  try {
    const u = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800&format=json`;
    const d = await (await fetch(u, { headers: UA })).json();
    const normalized = Object.fromEntries((d.query?.normalized || []).map((n) => [n.to, n.from]));
    for (const page of Object.values(d.query?.pages || {})) {
      const ii = page.imageinfo?.[0];
      if (!ii) continue;
      const orig = (normalized[page.title] || page.title).replace(/^File:/, "");
      const license = ii.extmetadata?.LicenseShortName?.value || "";
      if (!LICENSE_ALLOWLIST.test(license)) { info[orig] = null; refused += 1; continue; }
      info[orig] = {
        url: ii.thumburl || ii.url,
        page: ii.descriptionurl,
        license,
        credit: ((ii.extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, "").trim() || "Wikimedia Commons").slice(0, 120),
      };
    }
  } catch (err) {
    console.log(`  ✗ commons batch ${i}: ${err.message}`);
  }
  await pause(250);
}
console.log(`licensed: ${Object.values(info).filter(Boolean).length} | gate-refused: ${refused}`);

// Phase 3: write metadata. Identity gate: the filename must share at least
// one meaningful token with the entity name — catches wrong-QID drift (the
// "Metropolis" entity pointing at an ocean-ridge map) at the cost of a few
// legitimately-unrelated filenames. False negatives are fine in a backfill;
// false positives render wrong images on real pages.
const nameTokens = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().match(/[a-z0-9]{3,}/g) || [];
let applied = 0, identityRefused = 0;
for (const r of rows) {
  const f = p18[r.wikidata_qid];
  const img = f && info[f];
  if (!img) continue;
  const fileNorm = f.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!nameTokens(r.name).some((t) => fileNorm.includes(t))) { identityRefused += 1; continue; }
  applied += 1;
  if (dry) { if (applied <= 12) console.log(`  ${r.name} → ${f} [${img.license}]`); continue; }
  await q(
    `UPDATE entities SET metadata = metadata || $2::jsonb WHERE id = $1`,
    [r.id, JSON.stringify({ image_url: img.url, image_page: img.page, image_license: img.license, image_credit: img.credit })]
  );
}
console.log(`${dry ? "would apply" : "applied"}: ${applied} entity images | identity-gate refused: ${identityRefused}`);
await getPool().end();
