#!/usr/bin/env node
// Source pre/post accounting (2026-08-08, Tony's standard: "we should do
// this for all new sources"). Every provenance row carries its source_url,
// so each source's contribution is exactly attributable by host — and a
// snapshot taken before a new-source run, compared after, quantifies the
// incremental value even when other harvests overlap (per-host deltas
// don't conflate).
//
//   node scripts/source-report.mjs                       per-source rollup
//   node scripts/source-report.mjs --snapshot <label>    freeze per-subject
//        counts to data/snapshots/<YYYY-MM-DD>-<label>.json
//   node scripts/source-report.mjs --compare <fileA> <fileB>
//        delta table: overall + per-host + top-gaining subjects

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "unknown"; } };

/** Per-subject quote-confirmed counts, broken down by source host. */
async function perSubjectCounts() {
  const r = await q(
    `SELECT e.name, e.domain, p.source_url, p.published_date IS NOT NULL AS dated, p.source_degree
     FROM provenance p
     JOIN claims c ON c.id = p.claim_id
     JOIN entities e ON e.id IN (c.subject_id, c.object_id)
     WHERE p.verification_status = 'quote_confirmed'`
  );
  const by = {};
  for (const row of r.rows) {
    const s = (by[row.name] ||= { domain: row.domain, total: 0, dated: 0, first: 0, byHost: {} });
    s.total += 1;
    if (row.dated) s.dated += 1;
    if (row.source_degree === "first") s.first += 1;
    const h = host(row.source_url);
    s.byHost[h] = (s.byHost[h] || 0) + 1;
  }
  return by;
}

if (flag("--snapshot")) {
  const label = flag("--snapshot");
  const by = await perSubjectCounts();
  const dir = path.join(ROOT, "data", "snapshots");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().slice(0, 10)}-${label}.json`);
  writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), label, subjects: by }, null, 1));
  const totals = Object.values(by).reduce((a, s) => ({ total: a.total + s.total, first: a.first + s.first }), { total: 0, first: 0 });
  console.log(`snapshot "${label}" → ${path.relative(ROOT, file)}`);
  console.log(`${Object.keys(by).length} entities, ${totals.total} quote-confirmed citations (${totals.first} first-degree)`);
} else if (args.includes("--compare")) {
  const i = args.indexOf("--compare");
  const [a, b] = [args[i + 1], args[i + 2]].map((f) => JSON.parse(readFileSync(path.resolve(f), "utf8")));
  const names = new Set([...Object.keys(a.subjects), ...Object.keys(b.subjects)]);
  const hostDelta = {};
  const gains = [];
  let dTotal = 0, dFirst = 0, dDated = 0;
  for (const n of names) {
    const x = a.subjects[n] || { total: 0, dated: 0, first: 0, byHost: {} };
    const y = b.subjects[n] || { total: 0, dated: 0, first: 0, byHost: {} };
    dTotal += y.total - x.total; dFirst += y.first - x.first; dDated += y.dated - x.dated;
    if (y.total - x.total > 0) gains.push({ n, domain: y.domain, gain: y.total - x.total, firstGain: y.first - x.first });
    for (const h of new Set([...Object.keys(x.byHost), ...Object.keys(y.byHost)])) {
      const d = (y.byHost[h] || 0) - (x.byHost[h] || 0);
      if (d) hostDelta[h] = (hostDelta[h] || 0) + d;
    }
  }
  console.log(`═══ ${a.label} → ${b.label} ═══`);
  console.log(`citations: +${dTotal} (+${dFirst} first-degree, +${dDated} dated) | entities that gained: ${gains.length}`);
  console.log(`\nby source:`);
  for (const [h, d] of Object.entries(hostDelta).sort((p, q2) => q2[1] - p[1])) console.log(`  ${h.padEnd(28)} ${d > 0 ? "+" : ""}${d}`);
  console.log(`\ntop gains:`);
  for (const g of gains.sort((p, q2) => q2.gain - p.gain).slice(0, 15)) console.log(`  ${g.n.padEnd(30)} ${(g.domain || "?").padEnd(13)} +${g.gain}${g.firstGain ? ` (+${g.firstGain} first-degree)` : ""}`);
} else {
  // Rollup counts each provenance ROW once (per-subject counts intentionally
  // count both endpoints — "citations touching this subject" — but summing
  // those would double-count here).
  const r = await q(
    `SELECT p.source_url,
            count(*) FILTER (WHERE p.source_degree = 'first') AS first,
            count(*) AS n
     FROM provenance p WHERE p.verification_status = 'quote_confirmed'
     GROUP BY p.source_url`
  );
  const roll = {};
  const touched = {};
  for (const row of r.rows) {
    const h = host(row.source_url);
    const r0 = (roll[h] ||= { citations: 0, first: 0 });
    r0.citations += +row.n; r0.first += +row.first;
  }
  const e = await q(
    `SELECT p.source_url, c.subject_id, c.object_id FROM provenance p
     JOIN claims c ON c.id = p.claim_id WHERE p.verification_status = 'quote_confirmed'`
  );
  for (const row of e.rows) {
    const h = host(row.source_url);
    (touched[h] ||= new Set()).add(row.subject_id).add(row.object_id);
  }
  console.log(`${"SOURCE".padEnd(30)} ${"CITATIONS".padStart(9)}  ${"1ST-DEG".padStart(7)}  ${"ENTITIES".padStart(8)}`);
  for (const [h, r0] of Object.entries(roll).sort((p, q2) => q2[1].citations - p[1].citations).slice(0, 20)) {
    console.log(`${h.padEnd(30)} ${String(r0.citations).padStart(9)}  ${String(r0.first).padStart(7)}  ${String(touched[h]?.size || 0).padStart(8)}`);
  }
}
await getPool().end();
