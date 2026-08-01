#!/usr/bin/env node
// Classification hygiene (V3-51): subject kind/domain came from
// disambiguation guesses and drifted (directors stored as "film works",
// Socrates as "other work"). Wikidata's instance-of (P31) is deterministic
// ground truth: humans are creators, films/paintings/buildings are works.
// Zero tokens; only touches entities that HAVE a QID; idempotent.
//
//   node scripts/classify-entities.mjs [--dry]

import { readFileSync } from "node:fs";
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
const { searchEntity } = await import("../src/lib/entities/wikidata.js");
const { q, getPool } = await import("../src/lib/db.js");
const DRY = process.argv.includes("--dry");

// P31 class → {kind, domain?}. Kind is authoritative; domain only set for
// works (humans keep their curated domain).
const P31_MAP = {
  Q5: { kind: "person" },
  Q215380: { kind: "group" }, Q105756498: { kind: "group" }, Q2088357: { kind: "group" },
  Q11424: { kind: "work", domain: "film" }, Q24862: { kind: "work", domain: "film" }, Q506240: { kind: "work", domain: "television" },
  Q5398426: { kind: "work", domain: "television" }, Q1259759: { kind: "work", domain: "television" },
  Q7725634: { kind: "work", domain: "literature" }, Q47461344: { kind: "work", domain: "literature" }, Q571: { kind: "work", domain: "literature" }, Q49084: { kind: "work", domain: "literature" }, Q25379: { kind: "work", domain: "theater" },
  Q3305213: { kind: "work", domain: "art" }, Q860861: { kind: "work", domain: "art" }, Q125191: { kind: "work", domain: "art" },
  Q41176: { kind: "work", domain: "architecture" }, Q811979: { kind: "work", domain: "architecture" },
  Q482994: { kind: "work", domain: "music" }, Q7366: { kind: "work", domain: "music" }, Q169930: { kind: "work", domain: "music" },
  Q2743: { kind: "work", domain: "theater" }, Q58483083: { kind: "work", domain: "dance" },
};

// P106 occupation → domain for PERSONS (V3-51b): MusicBrainz-first
// disambiguation labels anyone with an MB presence as music (Homer! Fosse!).
// Wikidata's ordered occupation list corrects the browsing domain.
const P106_MAP = {
  Q2490358: "dance", Q5716684: "dance",           // choreographer (the QID that actually appears on Astaire/Fosse/Robbins/Bausch), dancer
  Q3501317: "fashion",                             // fashion designer
  Q42973: "architecture",                          // architect
  Q2526255: "film", Q3455803: "film", Q28389: "film", // film director, director, screenwriter
  Q1028181: "art", Q1281618: "art", Q33231: "art", // painter, sculptor, photographer
  Q36180: "literature", Q49757: "literature", Q6625963: "literature", Q214917: "literature", // writer, poet, novelist, playwright
  Q4964182: "other",                               // philosopher (Ideas)
  Q36834: "music", Q639669: "music", Q177220: "music", // composer, musician, singer
  Q947873: "television", Q578109: "television",    // presenter, TV producer
};

// V3-51 follow-up: "first mapped occupation wins" drifted — TV creators
// carry screenwriter/film credits ahead of TV-producer (Bochco → film) and
// dancers surface via actor/singer credits (Astaire). But a blanket
// priority list overshoots the other way: Hitchcock has a TV-producer
// credit, Michelangelo an architect one, Bowie literally lists painter
// FIRST. The tiers that fit the data:
//   1. choreographer is never a secondary credit → absolute priority
//      (plain "dancer" IS one — Prince has it; Astaire/Fosse/Robbins/
//      Bausch all carry choreographer Q2490358, Prince doesn't);
//   2. dance/fashion otherwise win — unless music is present (Prince,
//      Tyler, the Creator);
//   3. Wikidata's first occupation carries real primacy when it's a strong
//      primary (film director, architect, composer) — keeps Hitchcock and
//      Godard film while Bochco/Weiner/Brooks (screenwriter-first) move on;
//   4. television beats the scatter that screenwriter/producer credits
//      create (Bochco, Lear, Groening → television);
//   5. the entity's current domain stands when the occupation set agrees
//      with it — category rosters seeded domains correctly, so only
//      inconsistent labels are drift (keeps Bowie music despite painter,
//      Michelangelo art despite architect);
//   6. else first mapped occupation, as before.
const PRIMARY_OCCS = new Set(["Q2526255", "Q42973", "Q36834"]); // film director, architect, composer
const ABSOLUTE_OCCS = new Set(["Q2490358"]); // choreographer

function personDomain(claims, current) {
  const occs = (claims.P106 || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter((qid) => P106_MAP[qid]);
  if (!occs.length) return null;
  const domains = occs.map((qid) => P106_MAP[qid]);
  const absolute = occs.find((qid) => ABSOLUTE_OCCS.has(qid));
  if (absolute) return P106_MAP[absolute];
  if (domains.includes("dance") && !domains.includes("music")) return "dance";
  if (domains.includes("fashion") && !domains.includes("music")) return "fashion";
  if (PRIMARY_OCCS.has(occs[0])) return P106_MAP[occs[0]];
  if (domains.includes("television")) return "television";
  if (domains.includes(current)) return current;
  return domains[0];
}

// Only subjects (mixed entities) — the browsing surface Tony sees.
const subjects = await q(`
  SELECT DISTINCT e.id, e.name, e.kind, e.domain, e.domain_override, e.year_start, e.year_end, e.wikidata_qid
  FROM mixes m JOIN entities e ON e.id = m.subject_entity_id
  WHERE e.wikidata_qid IS NOT NULL`);

// QID backfill (V3-51 follow-up): the MusicBrainz-first drift left the
// worst-labeled subjects with NO QID at all (Fosse, Astaire, Lear — the
// exact cases this script exists to fix), so classification skipped them.
// Resolve conservatively: exact label match AND the top hit is a human
// (checked via P31 in the main loop). A wrong QID is worse than none —
// bands and homonym traps (Psycho the group, V3-08) stay unresolved.
const noQid = await q(`
  SELECT DISTINCT e.id, e.name, e.kind, e.domain, e.domain_override, e.year_start, e.year_end
  FROM mixes m JOIN entities e ON e.id = m.subject_entity_id
  WHERE e.wikidata_qid IS NULL`);
// Homonym traps checked against the mix payloads: OUR Paul Taylor is the
// smooth-jazz saxophonist and OUR John Meyer the Dutch garage guitarist
// (Arthur & the Cronies) — neither is on Wikidata; the exact-label hits
// are strangers (a power-electronics musician, an Australian politician).
const NOT_ON_WIKIDATA = new Set(["Paul Taylor", "John Meyer"]);
for (const row of noQid.rows) {
  if (NOT_ON_WIKIDATA.has(row.name)) continue;
  const exact = (await searchEntity(row.name, 5)).filter((h) => (h.label || "").toLowerCase() === row.name.toLowerCase());
  if (!exact.length) continue;
  // Among exact-label hits, take the first HUMAN with a mapped occupation:
  // skips "Homer (male given name)" for Q6691 the poet, and rejects the
  // bishops that "Miguel" surfaces instead of the R&B singer.
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", exact.map((h) => h.qid).join("|"));
  url.searchParams.set("props", "claims");
  url.searchParams.set("format", "json");
  const res = await fetchWithRetry(url, { headers: { "User-Agent": "Kynda/3.0 (brancato@gmail.com)" } });
  const cand = (await res.json()).entities || {};
  const hit = exact.find((h) => {
    const c = cand[h.qid]?.claims || {};
    return (c.P31 || []).some((x) => x.mainsnak?.datavalue?.value?.id === "Q5")
      && (c.P106 || []).some((x) => P106_MAP[x.mainsnak?.datavalue?.value?.id]);
  });
  if (!hit) continue;
  const taken = await q("SELECT id FROM entities WHERE wikidata_qid = $1", [hit.qid]);
  if (taken.rows.length) continue; // duplicate entity — dedupe's job, not ours
  subjects.rows.push({ ...row, wikidata_qid: hit.qid, resolved: hit.description || "?" });
  await new Promise((r) => setTimeout(r, 300));
}

console.log(`${subjects.rows.length} subjects to check (${noQid.rows.length} lacked QIDs)${DRY ? " (dry)" : ""}`);
let fixed = 0;
for (let i = 0; i < subjects.rows.length; i += 40) {
  const batch = subjects.rows.slice(i, i + 40);
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", batch.map((b) => b.wikidata_qid).join("|"));
  url.searchParams.set("props", "claims"); // P31 + P106 both live in claims
  url.searchParams.set("format", "json");
  const res = await fetchWithRetry(url, { headers: { "User-Agent": "Kynda/3.0 (brancato@gmail.com)" } });
  const entities = (await res.json()).entities || {};
  for (const row of batch) {
    const claims = entities[row.wikidata_qid]?.claims || {};
    const p31s = (claims.P31 || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
    if (row.resolved && !p31s.includes("Q5")) continue; // backfill accepts humans only
    const hit = p31s.map((qid) => P31_MAP[qid]).find(Boolean);
    if (!hit) continue;
    const newKind = hit.kind;
    // An admin override (V3-53, scripts/override-domain.mjs) pins the
    // browsing domain — hygiene never recomputes it.
    let newDomain = row.domain_override || hit.domain || row.domain;
    if (!row.domain_override && (newKind === "person" || newKind === "group")) {
      const occ = personDomain(claims, row.domain);
      if (occ) newDomain = occ;
    }
    // Years from Wikidata (V3-57): birth/death for people, inception/
    // dissolution for groups, publication or inception for works. Fills
    // gaps only — an existing year (e.g. MusicBrainz life-span) stands.
    const wdYear = (pid) => {
      const t = (claims[pid] || [])[0]?.mainsnak?.datavalue?.value?.time;
      const m = t?.match(/^([+-]\d{1,6})/);
      return m ? parseInt(m[1], 10) : null;
    };
    const ys = newKind === "person" ? wdYear("P569") : newKind === "group" ? wdYear("P571") : wdYear("P577") ?? wdYear("P571");
    const ye = newKind === "person" ? wdYear("P570") : newKind === "group" ? wdYear("P576") : null;
    const fillYs = row.year_start == null && ys != null;
    const fillYe = row.year_end == null && ye != null;
    if (newKind === row.kind && newDomain === row.domain && !fillYs && !fillYe && !row.resolved) continue;
    const yearNote = fillYs || fillYe ? ` [${fillYs ? ys : row.year_start}–${fillYe ? ye : row.year_end ?? ""}]` : "";
    console.log(`  ${row.name}: ${row.kind}/${row.domain} → ${newKind}/${newDomain}${yearNote}${row.resolved ? ` [+${row.wikidata_qid}: ${row.resolved}]` : ""}`);
    fixed += 1;
    if (!DRY) {
      if (row.resolved) await q("UPDATE entities SET wikidata_qid = COALESCE(wikidata_qid, $2) WHERE id = $1", [row.id, row.wikidata_qid]);
      await q(
        "UPDATE entities SET kind = $2, domain = $3, year_start = COALESCE(year_start, $4), year_end = COALESCE(year_end, $5) WHERE id = $1",
        [row.id, newKind, newDomain, ys, ye]
      );
    }
  }
  await new Promise((r) => setTimeout(r, 700));
}
console.log(`${DRY ? "would fix" : "fixed"}: ${fixed}`);
await getPool().end();
