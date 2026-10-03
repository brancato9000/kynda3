#!/usr/bin/env node
// One-time correction (2026-10-03): the corpus build saved subjects under the
// field disambiguation guessed (MusicBrainz → "music", else "other"), not the
// field on the build list — 79 of the first 160 were wrong (Picasso, Edward
// Hopper, John Ford as music; Le Corbusier, Fritz Lang with no field). Pins
// the roster field as domain_override for every saved subject in the given
// build-state files, and fixes kind from Wikidata where it says "human"
// (person) or a musical group (group). Zero model calls. Re-runnable.
//
//   node scripts/experiments/fix-build-fields.mjs build-state-*.json [--apply]
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
try {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".env.local");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* env */ }
const { q, getPool } = await import("../../src/lib/db.js");
const { fieldForCategory } = await import("../../src/lib/pipeline/roster-field.js");
const APPLY = process.argv.includes("--apply");
const files = process.argv.slice(2).filter((a) => a.endsWith(".json"));
const GROUP_CLASSES = new Set(["Q215380", "Q5741069", "Q2088357", "Q9212979", "Q281643", "Q641066", "Q56816954", "Q105543609"]);

const rows = [];
for (const f of files) {
  const st = JSON.parse(readFileSync(f, "utf8"));
  for (const s of st.subjects.filter((x) => ["saved", "read", "done"].includes(x.status))) {
    const want = fieldForCategory(s.category);
    const e = (await q(
      `SELECT e.id, e.name, e.kind, e.domain, e.domain_override, e.wikidata_qid FROM entities e
       WHERE (e.wikidata_qid = $1 AND $1 IS NOT NULL) OR lower(e.name) = lower($2)
       ORDER BY (e.wikidata_qid = $1) DESC NULLS LAST, EXISTS (SELECT 1 FROM mixes m WHERE m.subject_entity_id = e.id) DESC LIMIT 1`,
      [s.subject?.wikidata_qid || null, s.subject?.name || s.name])).rows[0];
    if (e) rows.push({ ...e, want });
  }
}
// Kinds from Wikidata instance-of
const qids = rows.filter((r) => /^Q\d+$/.test(r.wikidata_qid || "")).map((r) => r.wikidata_qid);
const p31 = {};
for (let i = 0; i < qids.length; i += 45) {
  const u = new URL("https://www.wikidata.org/w/api.php");
  for (const [k, v] of Object.entries({ action: "wbgetentities", ids: qids.slice(i, i + 45).join("|"), props: "claims", format: "json" })) u.searchParams.set(k, v);
  const j = await (await fetch(u, { headers: { "User-Agent": "Kynda/3.0 (brancato@gmail.com)" } })).json();
  for (const [id, ent] of Object.entries(j.entities || {})) p31[id] = (ent.claims?.P31 || []).map((c) => c.mainsnak?.datavalue?.value?.id);
}
let fields = 0, kinds = 0;
for (const r of rows) {
  const have = r.domain_override || r.domain;
  const classes = p31[r.wikidata_qid] || [];
  const kind = classes.includes("Q5") ? "person" : classes.some((c) => GROUP_CLASSES.has(c)) ? "group" : null;
  const fieldFix = r.want && have !== r.want;
  const kindFix = kind && r.kind !== kind && ["other", "work", "unknown"].includes(r.kind);
  if (!fieldFix && !kindFix) continue;
  console.log(`  ${r.name}: ${fieldFix ? `field ${have} → ${r.want}` : ""}${fieldFix && kindFix ? "; " : ""}${kindFix ? `kind ${r.kind} → ${kind}` : ""}`);
  if (APPLY) {
    if (fieldFix) { await q(`UPDATE entities SET domain_override = $2, updated_at = now() WHERE id = $1`, [r.id, r.want]); fields++; }
    if (kindFix) { await q(`UPDATE entities SET kind = $2, updated_at = now() WHERE id = $1`, [r.id, kind]); kinds++; }
  }
}
console.log(APPLY ? `pinned ${fields} fields, fixed ${kinds} kinds (${rows.length} subjects checked)` : `dry run: ${rows.length} subjects checked; --apply to write`);
await getPool().end();
