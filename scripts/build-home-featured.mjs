#!/usr/bin/env node
// Home featured rotation (2026-10-03, /discover prototype): picks the
// subjects each category card cycles through. Read-only against the DB;
// writes data/home-featured.json and prints the representation table.
//
// Candidates: mapped subjects with a rights-cleared picture, ranked by how
// much evidence the graph holds for them. Ranking by evidence alone
// reproduces the canon's skew, so the pick holds the 32% women floor
// among the people in every category and overall (Tony, 2026-09-29),
// and interleaves so a woman is always within the first two features.
// People are identified by Wikidata P31=Q5; gender by P21. Bands, works
// and ideas feature freely and don't count toward the floor.
//
//   node scripts/build-home-featured.mjs [perCategory=8]

import { readFileSync, writeFileSync } from "node:fs";
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
const { isPrivateSubject } = await import("../src/lib/site.js");

const PER = Number(process.argv[2]) || 8;
// Never featured on the home cards (still listed and mapped). Beyoncé (Tony,
// 2026-10-03): her 600-connection map crushes the visualization, a poor
// first impression from the home page's lead card.
const EXCLUDE = new Set(["Beyoncé"]);
const FLOOR = 0.32;

const rows = (await q(`
  SELECT e.id, e.name, e.kind, COALESCE(e.domain_override, e.domain) AS domain, e.wikidata_qid, e.year_start, e.year_end,
         (SELECT count(*) FROM claims c WHERE c.subject_id = e.id OR c.object_id = e.id)::int AS degree
  FROM entities e
  WHERE EXISTS (SELECT 1 FROM mixes m WHERE m.subject_entity_id = e.id)
    AND e.metadata->>'image_url' IS NOT NULL`)).rows
  .filter((s) => !isPrivateSubject(s.name) && !EXCLUDE.has(s.name));

// Same modern-canon gate as the home index (app/page.jsx, V3-57).
const isModern = (s) => s.kind === "person" || s.kind === "group"
  ? !(s.year_end != null && s.year_end < 1900) && !(s.year_end == null && s.year_start != null && s.year_start < 1850)
  : !(s.year_start != null && s.year_start < 1900);
const candidates = rows.filter((s) => s.domain !== "architecture" || isModern(s));

// Wikidata: who is human, and their P21.
const gender = new Map(); // qid -> "woman" | "man" | "other" ; absent = not a person
const qids = [...new Set(candidates.map((s) => s.wikidata_qid).filter(Boolean))];
const label = { Q6581072: "woman", Q1052281: "woman", Q6581097: "man", Q2449503: "man" };
for (let i = 0; i < qids.length; i += 50) {
  const url = new URL("https://www.wikidata.org/w/api.php");
  Object.entries({ action: "wbgetentities", ids: qids.slice(i, i + 50).join("|"), props: "claims", format: "json" })
    .forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetchWithRetry(url, { headers: { "User-Agent": "Kynda/3.0 (brancato@gmail.com)" } });
  for (const [id, ent] of Object.entries((await res.json()).entities || {})) {
    const p31 = (ent.claims?.P31 || []).map((c) => c.mainsnak?.datavalue?.value?.id);
    if (!p31.includes("Q5")) continue;
    const g = ent.claims?.P21?.[0]?.mainsnak?.datavalue?.value?.id;
    gender.set(id, label[g] || "other");
  }
}
const who = (s) => (s.wikidata_qid && gender.get(s.wikidata_qid)) || null;

const out = {};
const table = [];
for (const domain of [...new Set(candidates.map((s) => s.domain))].sort()) {
  const pool = candidates.filter((s) => s.domain === domain).sort((a, b) => b.degree - a.degree);
  // Strongest by evidence, then swap the weakest men out for the strongest
  // unpicked women until the category clears the floor (reserve = the rest).
  const picked = pool.slice(0, PER);
  const share = () => { const p = picked.filter(who); return p.length ? p.filter((s) => who(s) === "woman").length / p.length : 1; };
  const waiting = pool.slice(PER).filter((s) => who(s) === "woman");
  while (share() < FLOOR && waiting.length) {
    const i = picked.findLastIndex((s) => who(s) && who(s) !== "woman");
    if (i < 0) break;
    picked.splice(i, 1);
    picked.push(waiting.shift());
  }
  picked.sort((a, b) => b.degree - a.degree);
  // Rotation order: a woman within the first two features.
  const firstW = picked.findIndex((s) => who(s) === "woman");
  if (firstW > 1) picked.splice(1, 0, ...picked.splice(firstW, 1));
  out[domain] = picked.map((s) => s.name);
  const people = picked.filter((s) => who(s));
  const pw = people.filter((s) => who(s) === "woman").length;
  table.push({ category: domain === "other" ? "ideas" : domain, featured: picked.length, people: people.length, women: pw, pct: people.length ? Math.round((100 * pw) / people.length) + "%" : "—" });
}

const all = table.reduce((a, t) => ({ people: a.people + t.people, women: a.women + t.women }), { people: 0, women: 0 });
table.push({ category: "ALL", featured: table.reduce((n, t) => n + t.featured, 0), people: all.people, women: all.women, pct: Math.round((100 * all.women) / all.people) + "%" });
console.table(table);
const short = table.filter((t) => t.people && t.women / t.people < FLOOR);
if (short.length) console.warn("Below the 32% floor (not enough pictured women mapped yet):", short.map((t) => t.category).join(", "));

writeFileSync(path.join(ROOT, "data", "home-featured.json"),
  JSON.stringify({ generated: new Date().toISOString().slice(0, 10), perCategory: PER, features: out }, null, 2) + "\n");
console.log("wrote data/home-featured.json");
await getPool().end?.();
