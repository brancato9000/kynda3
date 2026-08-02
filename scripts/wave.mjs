#!/usr/bin/env node
// Validation wave (V3-45): seed-only corpus expansion — disambiguate → mix
// (Opus 5 default) → deterministic verification → persist. No web research
// (that's the $1.64 path); Wikipedia harvesting runs separately via
// `harvest.mjs --wikipedia-all`. Checkpointed: subjects with a stored mix
// are skipped, so reruns resume for free.
//
//   node scripts/wave.mjs subjects.tsv     (lines: "Category\tName")

import { readFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* env */ }

const { disambiguate } = await import("../src/lib/pipeline/disambiguate.js");
const { generateMix, verifyAttribution, verifyConnection, loadSubjectArticle, loadSubjectMembers } = await import("../src/lib/pipeline/mix.js");
const { persistMixRun, recordSearch, getStoredMix } = await import("../src/lib/store.js");
const { usageSummary } = await import("../src/lib/ai/anthropic.js");
const { getPool } = await import("../src/lib/db.js");

const BUDGET_USD = 15; // hard stop — the wave was approved at ~$11.50
const listPath = process.argv[2];
if (!listPath) { console.error("usage: wave.mjs subjects.tsv"); process.exit(1); }
const roster = readFileSync(listPath, "utf8").trim().split("\n")
  .map((l) => { const [category, name] = l.split("\t"); return { category, name }; })
  .filter((r) => r.name);

async function withRetry(label, fn, attempts = 3) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (err) {
      const transient = /terminated|529|overloaded|ECONNRESET|socket|fetch failed|max_tokens/i.test(err.message);
      if (i < attempts - 1 && transient) {
        console.log(`    [${label}] transient (${err.message}) — retry in ${15 * (i + 1)}s`);
        await new Promise((r) => setTimeout(r, 15_000 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
}

const perCategory = {}; // category → {subjects, candidates, verified, not_found, documented}
const rows = [];

for (const { category, name } of roster) {
  if (usageSummary().totalUsd >= BUDGET_USD) { console.log(`\n■ BUDGET STOP at $${usageSummary().totalUsd.toFixed(2)}`); break; }
  console.log(`\n▸ [${category}] ${name}`);
  const t0 = Date.now();
  try {
    const d = await withRetry("disambiguate", () => disambiguate(name));
    const subject = d.subject;
    if (!subject) { console.log("    ✗ no match"); rows.push({ category, name, status: "no_match" }); continue; }
    console.log(`    → ${subject.name}${subject.description ? ` (${subject.description})` : ""} [${d.confidence}]`);
    await recordSearch(name, subject, d.confidence).catch(() => {});

    const existing = await getStoredMix(subject).catch(() => null);
    if (existing?.slots) { console.log("    ⊘ already seeded"); rows.push({ category, name, status: "existing" }); continue; }

    const members = await loadSubjectMembers(subject).catch(() => []);
    const [mix, article] = await Promise.all([
      withRetry("generateMix", () => generateMix(subject, members)),
      loadSubjectArticle(subject),
    ]);
    const slots = [];
    const c = { candidates: 0, verified: 0, not_found: 0, documented: 0 };
    for (const slot of mix.slots) {
      const cands = [];
      for (const item of slot.candidates) {
        const [attribution, connection] = await Promise.all([
          verifyAttribution(item).catch(() => null),
          verifyConnection(item, subject, article, members).catch(() => null),
        ]);
        cands.push({ item, verification: { attribution, connection, citations: [] } });
        c.candidates += 1;
        if (attribution?.status === "verified") c.verified += 1;
        if (attribution?.status === "not_found") c.not_found += 1;
        if (connection?.status?.startsWith("documented")) c.documented += 1;
      }
      slots.push({ slotType: slot.slotType, candidates: cands });
    }
    await persistMixRun({ subject, rawQuery: name, intro: mix.intro, slots });

    const agg = (perCategory[category] ||= { subjects: 0, candidates: 0, verified: 0, not_found: 0, documented: 0 });
    agg.subjects += 1;
    for (const k of ["candidates", "verified", "not_found", "documented"]) agg[k] += c[k];
    rows.push({ category, name, resolved: subject.name, status: "seeded", ...c });
    console.log(`    ✓ seeded: ${c.candidates} candidates | ✓${c.verified} ✕${c.not_found} ◆${c.documented} | ${Math.round((Date.now() - t0) / 1000)}s | running $${usageSummary().totalUsd.toFixed(2)}`);
  } catch (err) {
    console.log(`    ✗ FAILED: ${err.message}`);
    rows.push({ category, name, status: "failed", error: err.message });
  }
  appendFileSync(path.join(ROOT, "wave-progress.jsonl"), JSON.stringify(rows[rows.length - 1]) + "\n");
}

console.log(`\n═══ WAVE SUMMARY ═══`);
for (const [cat, a] of Object.entries(perCategory)) {
  const pct = (n) => (a.candidates ? `${Math.round((100 * n) / a.candidates)}%` : "–");
  console.log(`  ${cat}: ${a.subjects} seeded | ${a.candidates} candidates | ✓ ${pct(a.verified)} | ✕ ${pct(a.not_found)} | ◆ ${pct(a.documented)}`);
}
console.log(`  failures: ${rows.filter((r) => r.status === "failed" || r.status === "no_match").map((r) => r.name).join(", ") || "none"}`);
console.log(`  TOTAL: $${usageSummary().totalUsd.toFixed(2)}`);
const { recordSpend } = await import("../src/lib/spend.js");
recordSpend(ROOT, "wave", usageSummary().totalUsd, `${rows.filter((r) => r.status === "seeded").length} seeded from ${path.basename(listPath)}`);
await getPool().end();
