#!/usr/bin/env node
// Classification hygiene (V3-51): subject kind/domain came from
// disambiguation guesses and drifted (directors stored as "film works",
// Socrates as "other work"). Wikidata's instance-of (P31) is deterministic
// ground truth: humans are creators, films/paintings/buildings are works.
// Zero tokens; only touches entities that HAVE a QID; idempotent.
//
//   node scripts/classify-entities.mjs [--dry]

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

const { fetchWithRetry } = await import("../src/lib/entities/net.js");
const { q, getPool } = await import("../src/lib/db.js");
const DRY = process.argv.includes("--dry");

// P31 class → {kind, domain?}. Kind is authoritative; domain only set for
// works (humans keep their curated domain).
const P31_MAP = {
  Q5: { kind: "person" },
  Q215380: { kind: "group" }, Q105756498: { kind: "group" }, Q2088357: { kind: "group" },
  Q11424: { kind: "work", domain: "film" }, Q24862: { kind: "work", domain: "film" }, Q506240: { kind: "work", domain: "television" },
  Q5398426: { kind: "work", domain: "television" }, Q1259759: { kind: "work", domain: "television" },
  Q7725634: { kind: "work", domain: "literature" }, Q47461344: { kind: "work", domain: "literature" }, Q571: { kind: "work", domain: "literature" }, Q49084: { kind: "work", domain: "literature" }, Q25379: { kind: "work", domain: "theater" },
  Q3305213: { kind: "work", domain: "art" }, Q860861: { kind: "work", domain: "art" }, Q125191: { kind: "work", domain: "art" },
  Q41176: { kind: "work", domain: "architecture" }, Q811979: { kind: "work", domain: "architecture" },
  Q482994: { kind: "work", domain: "music" }, Q7366: { kind: "work", domain: "music" }, Q169930: { kind: "work", domain: "music" },
  Q2743: { kind: "work", domain: "theater" }, Q58483083: { kind: "work", domain: "dance" },
};

// Only subjects (mixed entities) — the browsing surface Tony sees.
const subjects = await q(`
  SELECT DISTINCT e.id, e.name, e.kind, e.domain, e.wikidata_qid
  FROM mixes m JOIN entities e ON e.id = m.subject_entity_id
  WHERE e.wikidata_qid IS NOT NULL`);

console.log(`${subjects.rows.length} subjects with QIDs to check${DRY ? " (dry)" : ""}`);
let fixed = 0;
for (let i = 0; i < subjects.rows.length; i += 40) {
  const batch = subjects.rows.slice(i, i + 40);
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", batch.map((b) => b.wikidata_qid).join("|"));
  url.searchParams.set("props", "claims");
  url.searchParams.set("format", "json");
  const res = await fetchWithRetry(url, { headers: { "User-Agent": "Kynda/3.0 (brancato@gmail.com)" } });
  const entities = (await res.json()).entities || {};
  for (const row of batch) {
    const p31s = (entities[row.wikidata_qid]?.claims?.P31 || [])
      .map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
    const hit = p31s.map((qid) => P31_MAP[qid]).find(Boolean);
    if (!hit) continue;
    const newKind = hit.kind;
    const newDomain = hit.domain || row.domain;
    if (newKind === row.kind && newDomain === row.domain) continue;
    console.log(`  ${row.name}: ${row.kind}/${row.domain} → ${newKind}/${newDomain}`);
    fixed += 1;
    if (!DRY) await q("UPDATE entities SET kind = $2, domain = $3 WHERE id = $1", [row.id, newKind, newDomain]);
  }
  await new Promise((r) => setTimeout(r, 700));
}
console.log(`${DRY ? "would fix" : "fixed"}: ${fixed}`);
await getPool().end();
