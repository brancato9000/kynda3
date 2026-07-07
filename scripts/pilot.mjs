#!/usr/bin/env node
// The corpus pilot (MASTERPLAN Phase B, V3-20 economics).
//
// For each roster subject: seed (disambiguate → Fable mix → verify → persist,
// skipped if already in the graph) then research — Sonnet 5 first, one retry
// on empty, Fable escalation if still zero confirmed. Per-stratum accounting.
// Hard budget stop. Run under `caffeinate -i`.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* rely on environment */ }

const { disambiguate } = await import("../src/lib/pipeline/disambiguate.js");
const { generateMix, verifyAttribution, verifyConnection, loadSubjectArticle, loadSubjectMembers } = await import("../src/lib/pipeline/mix.js");
const { persistMixRun, recordSearch, enqueueSubjectByName, getStoredMix } = await import("../src/lib/store.js");
const { runResearchBatch } = await import("../src/lib/pipeline/research.js");
const { usageSummary } = await import("../src/lib/ai/anthropic.js");
const { getPool } = await import("../src/lib/db.js");

const BUDGET_USD = 200;

const ROSTER = [
  // Eval anchors — golden-set subjects with known-true facts
  { q: "David Bowie", stratum: "anchor" },
  { q: "Miles Davis", stratum: "anchor" },
  { q: "Joni Mitchell", stratum: "anchor" },
  { q: "Kendrick Lamar", stratum: "anchor" },
  { q: "Nirvana", stratum: "anchor" },
  // Music breadth — genres, eras, documentation cultures
  { q: "The Beatles", stratum: "breadth" },
  { q: "Prince", stratum: "breadth" },
  { q: "Kraftwerk", stratum: "breadth" },
  { q: "Aphex Twin", stratum: "breadth" },
  { q: "A Tribe Called Quest", stratum: "breadth" },
  { q: "Dolly Parton", stratum: "breadth" },
  { q: "Fela Kuti", stratum: "breadth" },
  { q: "Massive Attack", stratum: "breadth" },
  // Cross-domain stress tests
  { q: "The Godfather", stratum: "cross-domain" },
  { q: "Stanley Kubrick", stratum: "cross-domain" },
  { q: "Toni Morrison", stratum: "cross-domain" },
  { q: "Breaking Bad", stratum: "cross-domain" },
  { q: "Frida Kahlo", stratum: "cross-domain" },
  { q: "Zaha Hadid", stratum: "cross-domain" },
  { q: "Richard Pryor", stratum: "cross-domain" },
  // The August Factor
  { q: "Neutral Milk Hotel", stratum: "august" },
  { q: "The Shins", stratum: "august" },
  { q: "Vampire Weekend", stratum: "august" },
  { q: "Frank Sinatra", stratum: "august" },
  { q: "Buzzcocks", stratum: "august" },
  { q: "Flight of the Conchords", stratum: "august" },
  // Newness — young-cohort artists, shallow documentation pools
  { q: "Mitski", stratum: "newness" },
  { q: "Sabrina Carpenter", stratum: "newness" },
  { q: "Doechii", stratum: "newness" },
  { q: "Alex Warren", stratum: "newness" },
  { q: "Chappell Roan", stratum: "newness" },
  { q: "beabadoobee", stratum: "newness" },
];

let lastUsd = 0;
function stageCost() {
  const { totalUsd } = usageSummary();
  const d = totalUsd - lastUsd;
  lastUsd = totalUsd;
  return d;
}

async function withRetry(label, fn, attempts = 6, waitMs = 120_000) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const transient = /ENOTFOUND|ETIMEDOUT|ECONNRESET|Connection error|fetch failed|EAI_AGAIN|terminated|overloaded/i.test(String(err?.message) + String(err?.cause?.message || "") + String(err?.status || ""));
      if (i < attempts - 1 && transient) {
        console.log(`    [${label}] transient failure (${err.message}) — retry in ${waitMs / 1000}s`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
}

async function seed(query) {
  const d = await withRetry("disambiguate", () => disambiguate(query));
  const subject = d.subject;
  if (!subject) throw new Error(`no match for "${query}"`);
  if (d.confidence === "ambiguous") console.log(`    ⚠ ambiguous — proceeding with primary: ${subject.name} (${subject.description || subject.domain})`);
  else console.log(`    subject: ${subject.name}${subject.description ? ` (${subject.description})` : ""}`);
  await recordSearch(query, subject, d.confidence).catch(() => {});
  const existing = await getStoredMix(subject).catch(() => null);
  if (existing?.slots) {
    console.log("    seed exists — reusing");
    return { subject, counts: null };
  }
  const members = await loadSubjectMembers(subject);
  const [mix, article] = await Promise.all([
    withRetry("generateMix", () => generateMix(subject, members)),
    loadSubjectArticle(subject),
  ]);
  const slots = [];
  const counts = { candidates: 0, verified: 0, not_found: 0 };
  for (const slot of mix.slots) {
    const cands = [];
    for (const item of slot.candidates) {
      const [attribution, connection] = await Promise.all([
        verifyAttribution(item),
        verifyConnection(item, subject, article, members),
      ]);
      cands.push({ item, verification: { attribution, connection, citations: [] } });
      counts.candidates += 1;
      if (attribution.status === "verified") counts.verified += 1;
      if (attribution.status === "not_found") counts.not_found += 1;
    }
    slots.push({ slotType: slot.slotType, candidates: cands });
  }
  await persistMixRun({ subject, rawQuery: query, intro: mix.intro, slots });
  return { subject, counts };
}

async function researchWithPolicy(subjectName) {
  const attempts = [
    { model: "claude-sonnet-5", label: "sonnet-1" },
    { model: "claude-sonnet-5", label: "sonnet-2" },
    { model: "claude-fable-5", label: "fable-escalation" },
  ];
  let confirmed = 0, rejected = 0, escalated = false;
  for (const { model, label } of attempts) {
    await enqueueSubjectByName(subjectName);
    const totals = await withRetry(label, () => runResearchBatch(1, { model }));
    confirmed += totals.confirmed;
    rejected += totals.rejected;
    console.log(`    ${label}: +${totals.confirmed} confirmed / ${totals.rejected} rejected`);
    if (label === "fable-escalation") escalated = true;
    if (confirmed > 0) break; // stop as soon as any pass lands citations
  }
  return { confirmed, rejected, escalated };
}

const results = [];
const t0 = Date.now();
for (let i = 0; i < ROSTER.length; i++) {
  const { q: query, stratum } = ROSTER[i];
  const { totalUsd } = usageSummary();
  if (totalUsd > BUDGET_USD) {
    console.log(`\n■ BUDGET STOP: $${totalUsd.toFixed(2)} > $${BUDGET_USD} — halting at subject ${i + 1}/${ROSTER.length}`);
    break;
  }
  console.log(`\n[${i + 1}/${ROSTER.length}] ${query} (${stratum}) — spent so far: $${totalUsd.toFixed(2)}`);
  try {
    const tS = Date.now();
    const { subject, counts } = await seed(query);
    const seedUsd = stageCost();
    if (counts) console.log(`    seed: ${counts.candidates} candidates, ${counts.verified} verified, ${counts.not_found} failed | $${seedUsd.toFixed(2)}`);
    const r = await researchWithPolicy(subject.name);
    const researchUsd = stageCost();
    const row = { query, stratum, subject: subject.name, ...r, seedUsd, researchUsd, secs: Math.round((Date.now() - tS) / 1000) };
    results.push(row);
    console.log(`    ▸ DONE: ${r.confirmed} T2, ${r.rejected} rejected${r.escalated ? ", ESCALATED" : ""} | $${(seedUsd + researchUsd).toFixed(2)} | ${row.secs}s`);
  } catch (err) {
    console.log(`    ✗ SUBJECT FAILED: ${err.message}`);
    results.push({ query, stratum, subject: query, failed: true, error: err.message.slice(0, 200) });
    stageCost();
  }
  const stratumDone = !ROSTER[i + 1] || ROSTER[i + 1].stratum !== stratum;
  if (stratumDone) console.log(`■ STRATUM COMPLETE: ${stratum}`);
}

console.log("\n═══════════ PILOT REPORT ═══════════");
const strata = [...new Set(ROSTER.map((r) => r.stratum))];
for (const s of strata) {
  const rows = results.filter((r) => r.stratum === s && !r.failed);
  const failed = results.filter((r) => r.stratum === s && r.failed).length;
  if (!rows.length) { console.log(`${s}: no completed subjects (${failed} failed)`); continue; }
  const conf = rows.reduce((n, r) => n + r.confirmed, 0);
  const rej = rows.reduce((n, r) => n + r.rejected, 0);
  const usd = rows.reduce((n, r) => n + r.seedUsd + r.researchUsd, 0);
  const esc = rows.filter((r) => r.escalated).length;
  console.log(`${s}: ${rows.length} subjects${failed ? ` (+${failed} failed)` : ""} | ${conf} T2 confirmed, ${rej} rejected | ${esc} escalations | $${usd.toFixed(2)} ($${(usd / rows.length).toFixed(2)}/subject)`);
}
const { totalUsd, byLabel } = usageSummary();
for (const [label, s] of Object.entries(byLabel)) {
  console.log(`  ${label}: ${s.calls} calls, ${(s.in / 1000).toFixed(0)}k in / ${(s.out / 1000).toFixed(0)}k out${s.searches ? `, ${s.searches} searches` : ""} → $${s.usd.toFixed(2)}`);
}
console.log(`PILOT TOTAL: $${totalUsd.toFixed(2)} | ${((Date.now() - t0) / 60000).toFixed(0)} minutes`);
await getPool()?.end();
