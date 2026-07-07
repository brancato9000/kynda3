#!/usr/bin/env node
// The corpus sprint CLI (MASTERPLAN Phase B).
//
//   node scripts/research.js --subject "Radiohead"   research one subject now
//   node scripts/research.js --enqueue-top 20        seed queue from query_log
//   node scripts/research.js --batch 5               drain N queued subjects
//
// Requires DATABASE_URL and ANTHROPIC_API_KEY (reads .env.local).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Minimal .env.local loader (Next loads it for the app; plain node does not).
try {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* no .env.local — rely on the environment */ }

const { enqueueTopSearched, enqueueSubjectByName, nextQueuedSubjects } = await import("../src/lib/store.js");
const { runResearchBatch } = await import("../src/lib/pipeline/research.js");
const { getPool } = await import("../src/lib/db.js");
const { usageSummary } = await import("../src/lib/ai/anthropic.js");

function printCosts() {
  const { totalUsd, byLabel } = usageSummary();
  if (!totalUsd) return;
  console.log("\n— costs —");
  for (const [label, s] of Object.entries(byLabel)) {
    console.log(`  ${label}: ${s.calls} call(s), ${(s.in / 1000).toFixed(1)}k in / ${(s.out / 1000).toFixed(1)}k out${s.searches ? `, ${s.searches} web searches` : ""} → $${s.usd.toFixed(3)}`);
  }
  console.log(`  TOTAL: $${totalUsd.toFixed(3)}`);
}

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1] || true;
};

try {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set (add it to .env.local)");

  const subjectName = flag("--subject");
  const enqueueTop = flag("--enqueue-top");
  const batch = flag("--batch");

  if (enqueueTop) {
    const n = await enqueueTopSearched(parseInt(enqueueTop, 10) || 20);
    console.log(`enqueued/refreshed ${n} subjects from query_log`);
    const queued = await nextQueuedSubjects(50);
    console.log(queued.map((e) => `  · ${e.name}`).join("\n") || "  (queue empty)");
  }

  if (subjectName) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set (add it to .env.local)");
    const id = await enqueueSubjectByName(subjectName);
    if (!id) throw new Error(`"${subjectName}" not found in entities — search for it in the app first so it enters the graph`);
    const totals = await runResearchBatch(1);
    console.log(`\ndone: ${totals.confirmed} T2 citation(s) confirmed, ${totals.rejected} rejected by the evidence check`);
    printCosts();
  } else if (batch) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set (add it to .env.local)");
    const totals = await runResearchBatch(parseInt(batch, 10) || 3);
    console.log(`\ndone: ${totals.subjects} subject(s), ${totals.confirmed} T2 citation(s) confirmed, ${totals.rejected} rejected`);
    printCosts();
  }

  if (!subjectName && !batch && !enqueueTop) {
    console.log("usage: --subject \"Name\" | --enqueue-top N | --batch N");
  }
} catch (err) {
  console.error("error:", err.message);
  process.exitCode = 1;
} finally {
  await getPool()?.end();
}
