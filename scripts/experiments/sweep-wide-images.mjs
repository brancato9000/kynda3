#!/usr/bin/env node
// Wide-picture sweep (2026-10-03, Tony: horizontal logos "aren't satisfying" in round bubbles).
// 1. Measure every applied Commons picture and record its shape (metadata.image_aspect).
// 2. Works showing a picture wider than 1.25:1 get their poster/cover/jacket instead when the
//    same identity gates find one (posterFor); status is kept, identity notes the swap.
// 3. Measure pending Commons candidates so the queue can badge and gate wide ones.
// Zero model calls.   node scripts/experiments/sweep-wide-images.mjs [--dry] [--limit N]
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const p of [path.join(ROOT, ".env.local"), "/Users/tonybrancato/Documents/Projects/kynda3/.env.local"]) {
  try { for (const line of readFileSync(p, "utf8").split("\n")) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } break; } catch { /* next */ }
}
const { q, getPool } = await import(`${ROOT}/src/lib/db.js`);
const { posterFor, entityContext, applyEntityImage } = await import(`${ROOT}/src/lib/pipeline/map-images.js`);
const DRY = process.argv.includes("--dry");
const li = process.argv.indexOf("--limit"); const LIMIT = li === -1 ? Infinity : +process.argv[li + 1];
const UA = { "User-Agent": "Kynda/3.0 (kynda3.vercel.app; brancato@gmail.com)" };
const fileOf = (page) => (page && page.includes("commons.wikimedia.org/wiki/File:") ? decodeURIComponent(page.split("/wiki/File:")[1]).replace(/_/g, " ") : null);

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function commonsJSON(url) {
  for (let t = 0; t < 5; t++) {
    const r = await fetch(url, { headers: UA });
    const text = await r.text();
    try { return JSON.parse(text); } catch { await pause(2000 * (t + 1)); } // rate-limited: back off
  }
  return {};
}
async function shapes(files) {
  const out = new Map();
  for (let i = 0; i < files.length; i += 50) {
    const batch = files.slice(i, i + 50);
    await pause(250);
    const d = await commonsJSON(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=size&titles=${encodeURIComponent(batch.map((f) => "File:" + f).join("|"))}`);
    const norm = Object.fromEntries((d.query?.normalized || []).map((n) => [n.to, n.from]));
    for (const p of Object.values(d.query?.pages || {})) { const ii = p.imageinfo?.[0]; if (ii?.width && ii?.height) out.set((norm[p.title] || p.title).replace(/^File:/, ""), +(ii.width / ii.height).toFixed(3)); }
  }
  return out;
}

// 1 — applied pictures
const applied = (await q(`SELECT id, name, kind, domain, wikidata_qid, metadata FROM entities WHERE metadata->>'image_url' IS NOT NULL`)).rows;
const files = [...new Set(applied.map((e) => fileOf(e.metadata.image_page)).filter(Boolean))];
const dims = await shapes(files);
let measured = 0;
for (const e of applied) {
  const a = dims.get(fileOf(e.metadata.image_page));
  if (a == null) continue;
  e.aspect = a; measured += 1;
  if (!DRY && e.metadata.image_aspect !== a) await q(`UPDATE entities SET metadata = metadata || $2::jsonb WHERE id = $1`, [e.id, JSON.stringify({ image_aspect: a })]);
}
console.log(`measured ${measured} of ${applied.length} applied pictures`);

// 2 — works: poster instead of a wide or landscape picture
const works = applied.filter((e) => e.kind === "work" && e.aspect > 1.25).sort((a, b) => b.aspect - a.aspect).slice(0, LIMIT);
console.log(`${works.length} works showing a picture wider than 1.25:1`);
let swapped = 0, kept = 0;
// The article the current picture was approved from: a poster from that same article is the same work.
const approvedFrom = new Map((await q(`SELECT entity_id, title FROM image_candidates WHERE status = 'approved' AND title IS NOT NULL`)).rows.map((r) => [r.entity_id, r.title]));
const plainT = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
for (const e of works) {
  const poster = await posterFor(e, await entityContext(e.id), { alsoTry: approvedFrom.has(e.id) ? [approvedFrom.get(e.id)] : [] }).catch(() => null);
  const p = poster?.pick;
  const sameArticle = p && approvedFrom.has(e.id) && plainT(approvedFrom.get(e.id)) === plainT(p.title);
  // Better shape: a poster/cover/jacket (≤1.25:1); or, for an extreme wordmark (>2.5:1), a title card up to 1.8:1.
  const better = p && ((p.aspect ?? 1) <= 1.25 || (e.aspect > 2.5 && (p.aspect ?? 9) <= 1.8));
  if ((poster?.sure || sameArticle) && better && p.url !== e.metadata.image_url) {
    swapped += 1;
    console.log(`  ↻ ${e.name} — ${e.aspect}:1 → ${p.aspect ?? "?"}:1 (${p.fair_use ? "fair use" : p.license})`);
    if (!DRY) await applyEntityImage(e.id, { ...p, identity: `poster swap · ${sameArticle && !poster.sure ? "same article as the approved picture" : p.identity || ""}`.trim() }, e.metadata.image_status === "approved" ? "approved" : "auto");
  } else { kept += 1; }
}
console.log(`works: ${swapped} swapped to a poster/cover, ${kept} kept (no sure poster found — shown whole if wide)`);

// 3 — pending candidates
const cands = (await q(`SELECT id, page FROM image_candidates WHERE status = 'pending' AND aspect IS NULL AND page LIKE '%commons.wikimedia.org/wiki/File:%'`)).rows;
const cdims = await shapes([...new Set(cands.map((c) => fileOf(c.page)).filter(Boolean))]);
let cm = 0;
for (const c of cands) { const a = cdims.get(fileOf(c.page)); if (a == null) continue; cm += 1; if (!DRY) await q(`UPDATE image_candidates SET aspect = $2 WHERE id = $1`, [c.id, a]); }
console.log(`measured ${cm} of ${cands.length} pending Commons candidates`);
await getPool().end();
