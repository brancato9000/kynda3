#!/usr/bin/env node
// Source harvester CLI (V3-29).
//
//   node scripts/harvest.mjs --url "https://..."          harvest one source
//   node scripts/harvest.mjs --from-corpus N              harvest N distinct
//        already-confirmed source URLs from provenance (proven fetchable,
//        proven quote-rich — the validation set)
//   [--model sonnet|fable|haiku]                          default sonnet

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

const { harvestSource } = await import("../src/lib/pipeline/harvest.js");
const { usageSummary } = await import("../src/lib/ai/anthropic.js");
const { q, getPool } = await import("../src/lib/db.js");

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const MODELS = { sonnet: "claude-sonnet-5", fable: "claude-fable-5", haiku: "claude-haiku-4-5" };
const model = MODELS[flag("--model")] || MODELS.sonnet;

try {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  let urls = [];
  if (flag("--url")) urls = [flag("--url")];
  else if (flag("--from-corpus")) {
    const n = parseInt(flag("--from-corpus"), 10) || 5;
    const r = await q(
      `SELECT DISTINCT source_url FROM provenance
       WHERE verification_status = 'quote_confirmed' AND verification_method = 'primary_source_quote_match'
         AND source_url IS NOT NULL
         AND source_url NOT IN (
           SELECT DISTINCT p2.source_url FROM provenance p2
           JOIN claims c2 ON c2.id = p2.claim_id
           WHERE c2.agent_run_id LIKE 'harvest%' AND p2.source_url IS NOT NULL)
       LIMIT $1`,
      [n]
    );
    urls = r.rows.map((row) => row.source_url);
  } else {
    console.log('usage: --url "https://..." | --from-corpus N  [--model sonnet|fable|haiku]');
    process.exit(0);
  }

  let confirmed = 0, rejected = 0, sources = 0;
  const allSubjects = new Set();
  for (const url of urls) {
    console.log(`\n▸ harvesting ${url} (${model})`);
    try {
      const s = await harvestSource(url, { model });
      if (s.error) { console.log(`  ✗ ${s.error}`); continue; }
      sources += 1;
      confirmed += s.confirmed;
      rejected += s.rejected;
      s.subjects.forEach((x) => allSubjects.add(x));
      console.log(`  → ${s.confirmed} confirmed / ${s.rejected} rejected across ${s.subjects.length} subject(s)`);
    } catch (err) {
      console.log(`  ✗ harvest failed: ${err.message}`);
    }
  }

  const { totalUsd, byLabel } = usageSummary();
  console.log(`\n═══ HARVEST LEDGER ═══`);
  console.log(`sources: ${sources} | claims confirmed: ${confirmed} / rejected: ${rejected} | distinct subjects touched: ${allSubjects.size}`);
  for (const [label, s] of Object.entries(byLabel)) {
    console.log(`  ${label}: ${s.calls} call(s), ${(s.in / 1000).toFixed(1)}k in / ${(s.out / 1000).toFixed(1)}k out → $${s.usd.toFixed(3)}`);
  }
  console.log(`TOTAL: $${totalUsd.toFixed(3)}${confirmed ? ` | $${(totalUsd / confirmed).toFixed(3)} per confirmed citation` : ""}`);
} catch (err) {
  console.error("error:", err.message);
  process.exitCode = 1;
} finally {
  await getPool()?.end();
}
