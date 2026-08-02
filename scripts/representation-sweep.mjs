#!/usr/bin/env node
// Representation sweep: gender + ethnicity breakdown of the people Kynda
// features, per domain and overall. Read-only — never writes to the DB.
// Wikidata is the source: P21 (sex or gender), P172 (ethnic group), P27
// (citizenship, supporting context only). P172 is sparsely populated,
// especially for white subjects, so "unknown" there is NOT evidence of
// anything. Subjects without a QID land on a manual-review list, no guesses.
//
//   node scripts/representation-sweep.mjs [outfile.md]

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

const { fetchWithRetry } = await import("../src/lib/entities/net.js");
const { q, getPool } = await import("../src/lib/db.js");

const OUT = process.argv[2] ||
  path.join(ROOT, "reports", `representation-sweep-${new Date().toISOString().slice(0, 10)}.md`);

// All mix subjects, not just kind='person': kind drifts (Julia Morgan was
// stored as 'other'), so Wikidata P31=Q5 decides who is human.
const subjects = await q(`
  SELECT DISTINCT e.id, e.name, e.kind, e.domain, e.wikidata_qid
  FROM mixes m JOIN entities e ON e.id = m.subject_entity_id
  ORDER BY e.domain, e.name`);
const allSubjects = subjects.rows;
const withAnyQid = allSubjects.filter((p) => p.wikidata_qid);
console.log(`${allSubjects.length} mix subjects (${withAnyQid.length} with QIDs)`);

const wdGet = async (ids, props) => {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", ids.join("|"));
  url.searchParams.set("props", props);
  url.searchParams.set("languages", "en");
  url.searchParams.set("format", "json");
  const res = await fetchWithRetry(url, { headers: { "User-Agent": "Kynda/3.0 (brancato@gmail.com)" } });
  return (await res.json()).entities || {};
};

// Pass 1: claims for every subject QID (P31 to identify humans, plus P21/P172/P27).
const claimsByQid = {};
for (let i = 0; i < withAnyQid.length; i += 40) {
  const batch = withAnyQid.slice(i, i + 40);
  Object.assign(claimsByQid, await wdGet(batch.map((b) => b.wikidata_qid), "claims"));
  await new Promise((r) => setTimeout(r, 700));
}

const valueIds = (claims, prop) =>
  (claims?.[prop] || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);

const isHuman = (p) => {
  const claims = claimsByQid[p.wikidata_qid]?.claims;
  if (claims) return valueIds(claims, "P31").includes("Q5");
  return p.kind === "person"; // no QID → trust the curated kind
};
const people = allSubjects.filter(isHuman);
const misclassified = people.filter((p) => p.kind !== "person");
const withQid = people.filter((p) => p.wikidata_qid);
const noQid = people.filter((p) => !p.wikidata_qid);
console.log(`${people.length} humans (${noQid.length} without QIDs, ${misclassified.length} with kind != 'person')`);

// Pass 2: English labels for every value QID we saw (genders, ethnic groups, countries).
const labelQids = new Set();
for (const p of withQid) {
  const claims = claimsByQid[p.wikidata_qid]?.claims;
  for (const prop of ["P21", "P172", "P27"]) valueIds(claims, prop).forEach((id) => labelQids.add(id));
}
const labels = {};
const labelList = [...labelQids];
for (let i = 0; i < labelList.length; i += 40) {
  const batch = labelList.slice(i, i + 40);
  const ents = await wdGet(batch, "labels");
  for (const [qid, e] of Object.entries(ents)) labels[qid] = e.labels?.en?.value || qid;
  await new Promise((r) => setTimeout(r, 700));
}

const UNKNOWN = "unknown/unstated";
const rows = people.map((p) => {
  const claims = claimsByQid[p.wikidata_qid]?.claims;
  const name = (prop) => valueIds(claims, prop).map((id) => labels[id] || id);
  return {
    ...p,
    gender: p.wikidata_qid ? (name("P21")[0] || UNKNOWN) : UNKNOWN,
    ethnicity: p.wikidata_qid ? (name("P172").join(", ") || UNKNOWN) : UNKNOWN,
    citizenship: p.wikidata_qid ? name("P27").join(", ") : "",
  };
});

const tally = (list, key) => {
  const counts = {};
  for (const r of list) counts[r[key]] = (counts[r[key]] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};
const pct = (n, total) => `${n} (${Math.round((n / total) * 100)}%)`;
const countTable = (entries, total, header) => [
  `| ${header} | Count |`, "|---|---|",
  ...entries.map(([k, n]) => `| ${k} | ${pct(n, total)} |`),
].join("\n");

const domains = [...new Set(rows.map((r) => r.domain || "(none)"))].sort();
const md = [];
md.push(`# Representation sweep — ${new Date().toISOString().slice(0, 10)}`);
md.push(`\n${people.length} person subjects across ${domains.length} domains. Source: Wikidata P21 (gender), P172 (ethnic group), P27 (citizenship, context only). Read-only sweep; nothing written to the DB.`);
md.push(`\n> **Caveat on ethnicity:** Wikidata's P172 (ethnic group) is sparsely populated — editors add it mostly for subjects from underrepresented groups, and it is usually absent for white subjects. A large "${UNKNOWN}" bucket is expected and is **not** evidence of anything; do not read absence as either diversity or its lack. Use the per-subject appendix (with citizenship as weak context) plus your own knowledge when curating.`);

md.push(`\n## Overall`);
md.push(`\n### Gender\n\n${countTable(tally(rows, "gender"), rows.length, "Gender")}`);
md.push(`\n### Ethnic group (where stated on Wikidata)\n\n${countTable(tally(rows, "ethnicity"), rows.length, "Ethnic group")}`);

md.push(`\n## By domain`);
for (const d of domains) {
  const sub = rows.filter((r) => (r.domain || "(none)") === d);
  md.push(`\n### ${d} (${sub.length})`);
  md.push(`\n**Gender**\n\n${countTable(tally(sub, "gender"), sub.length, "Gender")}`);
  const eth = tally(sub, "ethnicity").filter(([k]) => k !== UNKNOWN);
  const ethUnknown = sub.length - eth.reduce((s, [, n]) => s + n, 0);
  md.push(`\n**Ethnic group:** ${eth.length ? eth.map(([k, n]) => `${k} (${n})`).join(", ") + `; ${UNKNOWN}: ${ethUnknown}` : `none stated; ${UNKNOWN}: ${ethUnknown}`}`);
}

if (misclassified.length) {
  md.push(`\n## Data hygiene — human on Wikidata but kind != 'person' (${misclassified.length})`);
  md.push(`\nIncluded in the counts above. \`scripts/classify-entities.mjs\` would fix the kind.\n`);
  for (const p of misclassified) md.push(`- ${p.name} (kind: ${p.kind}, ${p.domain || "no domain"})`);
}

if (noQid.length) {
  md.push(`\n## Manual review — no Wikidata QID (${noQid.length})`);
  md.push(`\nNo guesses made for these; review by hand.\n`);
  for (const p of noQid) md.push(`- ${p.name} (${p.domain || "no domain"})`);
}

md.push(`\n## Appendix — per subject\n`);
md.push(`| Name | Domain | Gender | Ethnic group | Citizenship |`);
md.push(`|---|---|---|---|---|`);
for (const r of rows) {
  md.push(`| ${r.name} | ${r.domain || ""} | ${r.gender} | ${r.ethnicity} | ${r.citizenship} |`);
}

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, md.join("\n") + "\n");
console.log(`wrote ${OUT}`);
await getPool().end();
