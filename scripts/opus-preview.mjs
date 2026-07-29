#!/usr/bin/env node
// V3-44 follow-up: a side-by-side prose preview — the live Fable mix vs a
// fresh Opus 5 mix for the same subject, every Opus card machine-verified.
// Writes a static page to public/opus-preview.html; persists nothing.
//
//   node scripts/opus-preview.mjs "The Shins"

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
try {
  for (const line of readFileSync(path.join(HERE, "..", ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* env */ }

const { generateMix, verifyAttribution, verifyConnection, loadSubjectArticle, loadSubjectMembers } = await import("../src/lib/pipeline/mix.js");
const { usageSummary } = await import("../src/lib/ai/anthropic.js");
const { MIX_SLOT_TYPES } = await import("../src/design/tokens.js");
const { q, getPool } = await import("../src/lib/db.js");

const NAME = process.argv[2] || "The Shins";
const SLOT_BY_ID = Object.fromEntries(MIX_SLOT_TYPES.map((s) => [s.id, s]));

const er = await q(
  "SELECT name, kind, domain, mbid, wikidata_qid FROM entities WHERE lower(name) = lower($1) ORDER BY (mbid IS NOT NULL) DESC LIMIT 1",
  [NAME]
);
const subject = er.rows[0];
if (!subject) { console.error("subject not in graph"); process.exit(1); }

const stored = await q(
  `SELECT m.payload FROM mixes m JOIN entities e ON e.id = m.subject_entity_id
   WHERE lower(e.name) = lower($1) ORDER BY m.created_at DESC LIMIT 1`,
  [NAME]
);
const fable = stored.rows[0]?.payload;
if (!fable?.slots) { console.error("no stored Fable mix with slots"); process.exit(1); }

console.log(`generating Opus 5 mix for ${subject.name}…`);
const members = await loadSubjectMembers(subject).catch(() => []);
const [opus, article] = await Promise.all([
  generateMix(subject, members, { model: "claude-opus-5" }),
  loadSubjectArticle(subject),
]);

console.log("verifying…");
const opusSlots = [];
for (const slot of opus.slots) {
  const candidates = [];
  for (const item of slot.candidates) {
    const attribution = await verifyAttribution(item).catch(() => null);
    const connection = await verifyConnection(item, subject, article, members).catch(() => null);
    candidates.push({ item, verification: { attribution, connection } });
    console.log(`  ${attribution?.status === "verified" ? "✓" : "·"} [${item.slotType}] ${item.title}`);
  }
  opusSlots.push({ slotType: slot.slotType, candidates });
}

const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function badges(v) {
  const out = [];
  const a = v?.attribution?.status;
  if (a === "verified") out.push('<span class="b ok">✓ verified</span>');
  else if (a === "not_found") out.push('<span class="b bad">✕ failed fact-check</span>');
  else out.push('<span class="b dim">unchecked</span>');
  const c = v?.connection?.status;
  if (c === "documented" || c === "documented_via") out.push('<span class="b gold">◆ documented</span>');
  else out.push('<span class="b dim">synthesis</span>');
  return out.join(" ");
}
function card(entry) {
  if (!entry?.item) return '<div class="card empty">—</div>';
  const { item, verification } = entry;
  return `<div class="card">
    <div class="t">${esc(item.title)}</div>
    <div class="c">${esc(item.creator)}${item.year ? ` · ${esc(item.year)}` : ""}</div>
    <div class="badges">${badges(verification)}</div>
    <p class="r">${esc(item.reason)}</p>
  </div>`;
}
function alternates(cands) {
  if (cands.length <= 1) return "";
  return `<div class="alts">also: ${cands.slice(1).map((c) => esc(c.item.title)).join(" · ")}</div>`;
}

const fableBySlot = Object.fromEntries(fable.slots.map((s) => [s.slotType, s.candidates]));
const opusBySlot = Object.fromEntries(opusSlots.map((s) => [s.slotType, s.candidates]));
const slotIds = [...new Set([...fable.slots.map((s) => s.slotType), ...opusSlots.map((s) => s.slotType)])]
  .filter((id) => id !== "covers" && id !== "covered_by");

const rows = slotIds.map((id) => {
  const meta = SLOT_BY_ID[id] || { label: id, emoji: "◆" };
  const f = fableBySlot[id] || [];
  const o = opusBySlot[id] || [];
  return `<div class="slotrow">
    <div class="slothead">${meta.emoji} ${esc(meta.label)}</div>
    <div class="pair">
      <div class="col">${card(f[0])}${alternates(f)}</div>
      <div class="col">${card(o[0])}${alternates(o)}</div>
    </div>
  </div>`;
}).join("\n");

const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(subject.name)} — Fable 5 vs Opus 5 (Kynda preview)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@300;400&family=DM+Sans:opsz,wght@9..40,300;9..40,400&display=swap" rel="stylesheet">
<style>
  body{margin:0;background:#0f1016;color:#e2e8f0;font-family:'DM Sans',sans-serif;padding:40px 20px 80px}
  .wrap{max-width:1040px;margin:0 auto}
  h1{font-family:'Instrument Serif',serif;font-weight:400;font-size:40px;margin:0}
  .sub{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(148,163,184,.6);margin:6px 0 8px}
  .note{font-size:13px;color:rgba(148,163,184,.8);max-width:640px;line-height:1.6;margin-bottom:28px}
  .colheads{display:grid;grid-template-columns:1fr 1fr;gap:16px;position:sticky;top:0;background:#0f1016;padding:10px 0;z-index:5}
  .colheads div{font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#facc15;border-bottom:1px solid rgba(250,204,21,.3);padding-bottom:8px}
  .intro-pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:26px}
  .intro-pair p{font-family:'Instrument Serif',serif;font-style:italic;font-size:15px;line-height:1.5;color:rgba(226,232,240,.85);margin:0;padding-right:8px}
  .slotrow{margin-bottom:26px}
  .slothead{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(148,163,184,.75);margin-bottom:10px}
  .pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .card{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:16px 18px;overflow-wrap:anywhere}
  .card.empty{display:flex;align-items:center;justify-content:center;color:rgba(148,163,184,.4)}
  .t{font-family:'Instrument Serif',serif;font-size:21px;line-height:1.2}
  .c{font-family:'DM Mono',monospace;font-size:11px;color:rgba(148,163,184,.75);margin:2px 0 8px}
  .badges{margin-bottom:8px}
  .b{font-family:'DM Mono',monospace;font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;border:1px solid;border-radius:3px;padding:2px 6px;margin-right:6px}
  .b.ok{color:#34d399;border-color:rgba(52,211,153,.35)}
  .b.bad{color:#f87171;border-color:rgba(248,113,113,.35)}
  .b.gold{color:#facc15;border-color:rgba(250,204,21,.3)}
  .b.dim{color:rgba(148,163,184,.6);border-color:rgba(148,163,184,.25)}
  .r{font-size:13px;line-height:1.6;color:rgba(226,232,240,.82);margin:0}
  .alts{font-family:'DM Mono',monospace;font-size:10px;color:rgba(148,163,184,.5);margin-top:6px}
  @media(max-width:720px){.pair,.intro-pair,.colheads{grid-template-columns:1fr}}
</style></head><body><div class="wrap">
<h1>${esc(subject.name)}</h1>
<div class="sub">model preview · same prompt, same schema, same machine verification</div>
<p class="note">Left: the live mix, written by Fable 5. Right: a fresh mix from Opus 5 (~⅓ the cost), generated for this comparison and never published. Badges on both sides are machine-earned. The question this page answers is the one machines can't: whose prose do you want on the cards?</p>
<div class="colheads"><div>Fable 5 — live today (~$0.30/mix)</div><div>Opus 5 — candidate (~$0.11/mix)</div></div>
<div class="intro-pair"><p>${esc(fable.intro)}</p><p>${esc(opus.intro)}</p></div>
${rows}
</div></body></html>`;

writeFileSync(path.join(HERE, "..", "public", "opus-preview.html"), html);
const u = usageSummary();
console.log(`\nwritten to public/opus-preview.html | cost: $${u.totalUsd.toFixed(3)}`);
await getPool().end();
