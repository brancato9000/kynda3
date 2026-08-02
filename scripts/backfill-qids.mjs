#!/usr/bin/env node
// QID backfill: mix subjects with no wikidata_qid are invisible to every
// deterministic fixer (classify-entities, domain verifiers, the
// representation sweep). Search Wikidata by name and attach a QID only when
// the match is unambiguous: exact label match (case/diacritic-insensitive)
// AND the entity is a human (P31=Q5). Anything fuzzier stays untouched —
// a wrong QID is worse than none.
//
//   node scripts/backfill-qids.mjs [--dry]

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

const { searchEntity } = await import("../src/lib/entities/wikidata.js");
const { fetchWithRetry } = await import("../src/lib/entities/net.js");
const { q, getPool } = await import("../src/lib/db.js");
const DRY = process.argv.includes("--dry");

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Domain-consistency check: exact label + human is not enough for common
// names ("Miguel" exact-matches a bishop before the singer). The candidate's
// Wikidata description must also look like the subject's curated domain.
const DOMAIN_WORDS = {
  music: /sing|rapper|musician|dj|composer|record|band|song/i,
  literature: /writer|novelist|poet|author|playwright/i,
  art: /painter|artist|sculptor|photograph/i,
  film: /film|director|screenwriter|actor|actress/i,
  television: /television|tv|comedian|presenter|showrunner|producer/i,
  dance: /choreograph|dancer|ballet/i,
  fashion: /fashion|designer|couturier/i,
  architecture: /architect/i,
  // 'other' also holds subjects whose domain drifted (Jane Austen was stored
  // as work/other), so it accepts writer-words too.
  other: /philosoph|thinker|invent|scientist|activist|writ|theolog|novelist|poet|author/i,
};

// Known duplicates awaiting dedupe — a QID here would legitimize the dupe.
const SKIP = new Set(["John Meyer"]); // duplicate of John Mayer (has QID)

const subjects = await q(`
  SELECT DISTINCT e.id, e.name, e.domain
  FROM mixes m JOIN entities e ON e.id = m.subject_entity_id
  WHERE e.wikidata_qid IS NULL
  ORDER BY e.name`);
console.log(`${subjects.rows.length} mix subjects without QIDs${DRY ? " (dry)" : ""}`);

let set = 0;
for (const row of subjects.rows) {
  if (SKIP.has(row.name)) { console.log(`  ⊘ ${row.name}: on the dedupe skip list`); continue; }
  const candidates = await searchEntity(row.name, 6).catch(() => []);
  const exact = candidates.filter((c) => c.label && norm(c.label) === norm(row.name));
  if (!exact.length) { console.log(`  ? ${row.name}: no exact label match`); continue; }

  // Confirm humanity (P31=Q5) for the exact matches; take the first human.
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", exact.map((c) => c.qid).join("|"));
  url.searchParams.set("props", "claims");
  url.searchParams.set("format", "json");
  const res = await fetchWithRetry(url, { headers: { "User-Agent": "Kynda/3.0 (brancato@gmail.com)" } });
  const entities = (await res.json()).entities || {};
  const humans = exact.filter((c) =>
    (entities[c.qid]?.claims?.P31 || []).some((cl) => cl.mainsnak?.datavalue?.value?.id === "Q5"));
  if (!humans.length) { console.log(`  ? ${row.name}: exact matches but none human`); continue; }

  const domainWords = DOMAIN_WORDS[row.domain];
  const fits = domainWords ? humans.filter((c) => domainWords.test(c.description || "")) : humans;
  if (fits.length !== 1) {
    console.log(`  ? ${row.name}: ${fits.length ? "ambiguous" : "no domain-consistent match"} (${humans.map((c) => `${c.qid}: ${c.description}`).join(" | ")})`);
    continue;
  }

  console.log(`  ✓ ${row.name} → ${fits[0].qid} (${fits[0].description || "no description"})`);
  set += 1;
  if (!DRY) await q("UPDATE entities SET wikidata_qid = $2 WHERE id = $1", [row.id, fits[0].qid]);
  await new Promise((r) => setTimeout(r, 400));
}
console.log(`${DRY ? "would set" : "set"}: ${set}`);
await getPool().end();
