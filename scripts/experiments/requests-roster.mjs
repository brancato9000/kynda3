// Approved map requests → a build list (Tony, 2026-10-03). Visitors ask for
// maps on the site; Tony approves them in /admin; this writes the approved,
// still-unmapped ones as a roster for scripts/build-batch.mjs
// ("Field\tName\tQID" — the Wikidata ID skips search, so the build makes
// exactly the subject the visitor asked for). Free: database reads only.
//
//   node scripts/experiments/requests-roster.mjs [out.tsv]
//   node scripts/build-batch.mjs out.tsv --resolve-only   (then approve the spend)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
try {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".env.local");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* env */ }
const { getPool } = await import("../../src/lib/db.js");
const { listMapRequests } = await import("../../src/lib/store.js");
const { fieldForCategory } = await import("../../src/lib/pipeline/roster-field.js");

const out = process.argv[2] || `scripts/experiments/requests-${new Date().toISOString().slice(0, 10)}.tsv`;
const rows = (await listMapRequests({ statuses: ["approved"], limit: 1000 })).filter((r) => !r.mapped);
const lines = rows.map((r) => [fieldForCategory(r.domain) || "other", r.name.replace(/\t/g, " "), r.wikidata_qid || ""].join("\t").replace(/\t$/, ""));
if (lines.length) writeFileSync(out, lines.join("\n") + "\n");
console.log(lines.length ? `${lines.length} approved requests → ${out}` : "No approved requests waiting.");
for (const r of rows) console.log(`  ${String(r.votes).padStart(3)}×  ${r.name}${r.wikidata_qid ? ` (${r.wikidata_qid})` : ""}`);
await getPool().end();
