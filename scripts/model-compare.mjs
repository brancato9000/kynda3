#!/usr/bin/env node
// Model evaluation for mix generation (V3-44): can Opus 5 ($5/$25) replace
// Fable 5 ($10/$50)? The truth-first architecture makes this measurable —
// generate with the candidate model, run the SAME deterministic verifiers,
// and compare badge rates against the stored Fable mixes. No model judges
// a model; the databases do.
//
//   node scripts/model-compare.mjs --model claude-opus-5 "Radiohead" "The Godfather" ...
//
// Nothing is persisted: no claims, no mixes, no graph pollution.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
try {
  for (const line of readFileSync(path.join(HERE, "..", ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* env */ }

const { generateMix, verifyAttribution, verifyConnection, loadSubjectArticle, loadSubjectMembers } = await import("../src/lib/pipeline/mix.js");
const { usageSummary } = await import("../src/lib/ai/anthropic.js");
const { scoreMixResult } = await import("../eval/scoring.js");
const { q, getPool } = await import("../src/lib/db.js");
const { slugify } = await import("../src/lib/slug.js");

const args = process.argv.slice(2);
const modelIdx = args.indexOf("--model");
const MODEL = modelIdx > -1 ? args[modelIdx + 1] : "claude-opus-5";
const subjects = args.filter((a, i) => a !== "--model" && i !== modelIdx + 1);
if (!subjects.length) {
  console.error('usage: model-compare.mjs --model claude-opus-5 "Subject" ...');
  process.exit(1);
}

function tally(verifs) {
  const t = { candidates: 0, verified: 0, not_found: 0, unchecked: 0, documented: 0, synthesis: 0 };
  for (const v of verifs) {
    if (!v) continue;
    t.candidates += 1;
    const a = v.attribution?.status;
    if (a === "verified") t.verified += 1;
    else if (a === "not_found") t.not_found += 1;
    else t.unchecked += 1;
    const c = v.connection?.status;
    if (c === "documented" || c === "documented_via") t.documented += 1;
    else if (c && c !== "not_applicable") t.synthesis += 1;
  }
  return t;
}

function fmt(t) {
  const pct = (n) => (t.candidates ? `${Math.round((100 * n) / t.candidates)}%` : "–");
  return `${t.candidates} candidates | ✓ verified ${t.verified} (${pct(t.verified)}) | ✕ failed ${t.not_found} (${pct(t.not_found)}) | ◆ documented ${t.documented} (${pct(t.documented)})`;
}

for (const name of subjects) {
  console.log(`\n═══ ${name} — ${MODEL} ═══`);
  const er = await q(
    "SELECT name, kind, domain, mbid, wikidata_qid FROM entities WHERE lower(name) = lower($1) ORDER BY (mbid IS NOT NULL OR wikidata_qid IS NOT NULL) DESC LIMIT 1",
    [name]
  );
  const subject = er.rows[0];
  if (!subject) { console.log("  ✗ not in graph"); continue; }

  const members = await loadSubjectMembers(subject).catch(() => []);
  const [mix, article] = await Promise.all([
    generateMix(subject, members, { model: MODEL }),
    loadSubjectArticle(subject),
  ]);

  // The same deterministic gauntlet the live route runs — sequential per
  // MusicBrainz etiquette.
  const verifs = [];
  const flatItems = [];
  for (const slot of mix.slots) {
    for (const item of slot.candidates) {
      flatItems.push(item);
      const [attribution, connection] = [
        await verifyAttribution(item).catch((e) => ({ status: "error", reason: e.message })),
        await verifyConnection(item, subject, article, members).catch(() => null),
      ];
      verifs.push({ attribution, connection });
      const a = attribution?.status === "verified" ? "✓" : attribution?.status === "not_found" ? "✕" : "·";
      const c = connection?.status?.startsWith("documented") ? "◆" : " ";
      console.log(`  ${a}${c} [${item.slotType}] ${item.title} — ${item.creator}`);
    }
  }
  console.log(`  → ${fmt(tally(verifs))}`);

  // Golden-set trap scoring where a golden file exists.
  try {
    const golden = JSON.parse(readFileSync(path.join(HERE, "..", "eval", "golden", `${slugify(subject.name)}.json`), "utf8"));
    const score = scoreMixResult({ items: flatItems.map((i) => ({ slotType: i.slotType, title: i.title, creator: i.creator })) }, golden);
    console.log(`  golden: ${score.pass ? "PASS — 0 violations" : `${score.violations.length} violations: ${score.violations.map((v) => v.type).join(", ")}`}`);
  } catch { /* no golden file */ }

  // Baseline: the stored Fable mix's persisted verifications.
  const stored = await q(
    `SELECT m.payload FROM mixes m JOIN entities e ON e.id = m.subject_entity_id
     WHERE lower(e.name) = lower($1) ORDER BY m.created_at DESC LIMIT 1`,
    [name]
  );
  if (stored.rows[0]) {
    const baseVerifs = (stored.rows[0].payload.slots || []).flatMap((s) => (s.candidates || []).map((c) => c.verification));
    console.log(`  fable baseline: ${fmt(tally(baseVerifs))}`);
  }
}

const u = usageSummary();
console.log(`\n═══ COST ═══`);
for (const [label, s] of Object.entries(u.byLabel)) {
  console.log(`  ${label}: ${s.calls} call(s), ${(s.in / 1000).toFixed(1)}k in / ${(s.out / 1000).toFixed(1)}k out → $${s.usd.toFixed(3)}`);
}
console.log(`  TOTAL: $${u.totalUsd.toFixed(3)}`);
await getPool().end();
