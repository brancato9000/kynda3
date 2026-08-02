#!/usr/bin/env node
// Spend report (V3-60): sums spend.jsonl — the answer to "how much did we
// spend?" as a receipt instead of an estimate.
//
//   node scripts/spend.mjs           totals overall, by script, last 14 days
//   node scripts/spend.mjs --today

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spendFile } from "../src/lib/spend.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let rows = [];
try {
  rows = readFileSync(spendFile(ROOT), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
} catch {
  console.log("no spend recorded yet (spend.jsonl is empty or absent)");
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
if (process.argv.includes("--today")) rows = rows.filter((r) => r.ts.slice(0, 10) === today);

const sum = (xs) => xs.reduce((n, r) => n + r.usd, 0);
console.log(`TOTAL: $${sum(rows).toFixed(2)} across ${rows.length} run(s)`);

const byScript = {};
for (const r of rows) (byScript[r.script] ||= []).push(r);
for (const [script, xs] of Object.entries(byScript)) {
  console.log(`  ${script}: $${sum(xs).toFixed(2)} (${xs.length} run(s))`);
}

const byDay = {};
for (const r of rows) (byDay[r.ts.slice(0, 10)] ||= []).push(r);
const days = Object.keys(byDay).sort().slice(-14);
if (days.length > 1 || !process.argv.includes("--today")) {
  console.log("\nby day:");
  for (const d of days) {
    console.log(`  ${d}: $${sum(byDay[d]).toFixed(2)}${d === today ? "  ← today" : ""}`);
    for (const r of byDay[d]) console.log(`      $${r.usd.toFixed(2).padStart(6)}  ${r.script}: ${r.note || ""}`);
  }
}
