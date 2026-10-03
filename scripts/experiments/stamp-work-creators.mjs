#!/usr/bin/env node
// Creator sweep (Tony, 2026-10-03): influence claims pointing at works with
// no maker recorded leave map dead ends and hid self-citations (Bowie →
// Let's Dance). For each such work, Wikidata names the maker (performer,
// author, director, creator, composer, architect, screenwriter, lyricist,
// producer, …) of items whose label matches the title exactly; a maker is
// stamped ONLY when its name also appears in our own evidence for the work
// (claim summaries, quoted sources, context) or is already linked to it by
// another claim — same-title collisions ("Heroes") never pass. Exactly one
// maker must pass. Zero model calls.
//
//   node scripts/experiments/stamp-work-creators.mjs           dry run
//   node scripts/experiments/stamp-work-creators.mjs --apply   stamp
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
const { q, getPool } = await import("../../src/lib/db.js");
const APPLY = process.argv.includes("--apply");
const UA = { "User-Agent": "Kynda/3.0 (brancato@gmail.com)" };
// Ranked: an item's maker comes from its highest-ranked role present —
// author / director / creator / architect first, then performer, then
// screenwriter, composer, lyricist. Producers are never makers (Animal House
// is Landis's, not producer Reitman's; Thunderbirds is Anderson's, not
// composer Barry Gray's).
const MAKER_RANKS = [["P50", "P57", "P170", "P84"], ["P175"], ["P58"], ["P86", "P676", "P87", "P286"]];
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/^(the|a|an) /, "").replace(/[^a-z0-9]+/g, "");
const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function wd(params) {
  const u = new URL("https://www.wikidata.org/w/api.php");
  for (const [k, v] of Object.entries({ ...params, format: "json" })) u.searchParams.set(k, v);
  for (let i = 0; i < 3; i++) {
    const r = await fetch(u, { headers: UA }).catch(() => null);
    if (r?.ok) return r.json();
    await pause(2000 * (i + 1));
  }
  return {};
}

const works = (await q(`
  SELECT o.id, o.name,
    string_agg(DISTINCT coalesce(c.summary,'') || ' ' || coalesce(p.quote,'') || ' ' || coalesce(p.context_before,'') || ' ' || coalesce(p.context_after,''), ' ') AS evidence,
    array_agg(DISTINCT n.name) AS neighbors
  FROM entities o
  JOIN claims c ON c.object_id = o.id OR c.subject_id = o.id
  LEFT JOIN provenance p ON p.claim_id = c.id
  JOIN entities n ON n.id = CASE WHEN c.subject_id = o.id THEN c.object_id ELSE c.subject_id END
  WHERE o.kind IN ('work','film','tv_show','book','release','recording')
    AND COALESCE(o.metadata->>'creator','') = ''
    AND EXISTS (SELECT 1 FROM claims ci WHERE ci.object_id = o.id
                AND ci.claim_type IN ('influenced_by','cited_as_influence','cross_medium_influence','studied_under'))
  GROUP BY o.id, o.name`)).rows;
console.log(`${works.length} artistless works that influence claims point at`);

const out = [];
for (const w of works) {
  const s = await wd({ action: "wbsearchentities", search: w.name, language: "en", limit: "7" });
  const ids = (s.search || []).filter((x) => norm(x.label) === norm(w.name)).map((x) => x.id);
  if (!ids.length) { await pause(100); continue; }
  const e = await wd({ action: "wbgetentities", ids: ids.join("|"), props: "claims" });
  const makerIds = new Map(); // maker qid → item qid
  for (const [iid, ent] of Object.entries(e.entities || {})) {
    const rank = MAKER_RANKS.find((props) => props.some((p) => ent.claims?.[p]?.length)) || [];
    for (const p of rank) for (const st of ent.claims?.[p] || []) {
      const mid = st.mainsnak?.datavalue?.value?.id; if (mid && !makerIds.has(mid)) makerIds.set(mid, iid);
    }
  }
  if (!makerIds.size) { await pause(100); continue; }
  const labels = await wd({ action: "wbgetentities", ids: [...makerIds.keys()].slice(0, 45).join("|"), props: "labels", languages: "en" });
  const ev = fold(w.evidence + " " + (w.neighbors || []).join(" "));
  const hits = [];
  for (const [mid, ent] of Object.entries(labels.entities || {})) {
    const name = ent.labels?.en?.value; if (!name) continue;
    const last = fold(name).split(/\s+/).pop();
    const inEvidence = ev.includes(fold(name)) || (last.length > 3 && new RegExp(`\\b${last.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(ev) && (w.neighbors || []).some((nb) => fold(nb) === fold(name)));
    if (inEvidence) hits.push({ maker: name, makerQid: mid, item: makerIds.get(mid) });
  }
  // A "work" named exactly like its maker is an artist misfiled as a work
  // (Shawn Mendes, AC/DC): a field-label job, not a creator stamp.
  const uniq = [...new Map(hits.filter((h) => norm(h.maker) !== norm(w.name)).map((h) => [h.maker, h])).values()];
  if (uniq.length === 1) out.push({ id: w.id, work: w.name, ...uniq[0] });
  else if (uniq.length > 1) out.push({ id: w.id, work: w.name, ambiguous: uniq.map((h) => h.maker) });
  await pause(150);
}
// Held back at review (2026-10-03): the matched item may be a different work
// of the same name (novel vs film, play vs diary, Jay-Z's album vs Scott's
// film) or the attribution is traditional, not authorship.
const HELD = new Set(["Gone with the Wind", "The Diary of Anne Frank", "American Gangster", "Homeric Hymns"]);
const ok = out.filter((x) => !x.ambiguous && !HELD.has(x.work)), amb = out.filter((x) => x.ambiguous);
writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "repairs", "2026-10-03-work-creators.json"), JSON.stringify(out, null, 1));
for (const x of ok) console.log(`  ${x.work} → ${x.maker}`);
for (const x of amb) console.log(`  ? ${x.work}: ${x.ambiguous.join(" / ")} (left alone)`);
console.log(`${ok.length} makers to stamp, ${amb.length} ambiguous (left alone), ${works.length - out.length} without a confident match`);
if (APPLY) {
  for (const x of ok) await q(`UPDATE entities SET metadata = metadata || jsonb_build_object('creator', $2::text), updated_at = now()
                               WHERE id = $1 AND COALESCE(metadata->>'creator','') = ''`, [x.id, x.maker]);
  console.log(`stamped ${ok.length}`);
}
await getPool().end();
