#!/usr/bin/env node
// Fresh Air batch harvester (2026-08-08) — the Fresh Air Archive
// (freshairarchive.org) carries full interview transcripts inline as
// ordinary HTML back to 1975, with per-guest pages at /guests/<slug>.
// First-degree, artist's-own-words territory: the 5-transcript pilot
// yielded 51 confirmed citations ($0.012 each) with cited_as_influence
// in the artist's own voice in 4 of 5 mediums.
//
//   node scripts/harvest-freshair.mjs --subject "Keith Jarrett"
//   node scripts/harvest-freshair.mjs --subjects "A|B|C"
//   node scripts/harvest-freshair.mjs --corpus        every corpus subject
//   [--segments N]   max interview segments per guest (default 3)
//   [--model sonnet|fable|haiku]                      (default sonnet)
//
// Flow per subject: guess the guest slug from the name (404 = not a Fresh
// Air guest, costs nothing) → collect /segments/ links → original
// interviews before "remembering"/compilation segments (pilot lesson:
// memorials are mostly host narration) → harvestSource() on each page,
// which extraction, shape gates, and the quote wall already handle.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

try {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* env */ }

const { harvestSource } = await import("../src/lib/pipeline/harvest.js");
const { usageSummary } = await import("../src/lib/ai/anthropic.js");
const { listSubjects } = await import("../src/lib/store.js");
const { q, getPool } = await import("../src/lib/db.js");

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const MODELS = { sonnet: "claude-sonnet-5", fable: "claude-fable-5", haiku: "claude-haiku-4-5" };
const model = MODELS[flag("--model")] || MODELS.sonnet;
const maxSegments = parseInt(flag("--segments"), 10) || 3;

const UA = { "User-Agent": "Mozilla/5.0 (compatible; Kynda/3.0; brancato@gmail.com)" };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** "Cristóbal Balenciaga" → "cristobal-balenciaga"; "Ursula K. Le Guin" → "ursula-k-le-guin" */
function guestSlug(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Compilations last: original interviews carry the first-degree material. */
function segmentPriority(slug) {
  return /remember|favorites|looks-back|tribute/.test(slug) ? 1 : 0;
}

async function guestSegments(name) {
  const url = `https://freshairarchive.org/guests/${guestSlug(name)}`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) return null; // not a Fresh Air guest
  const html = await r.text();
  const slugs = [...new Set([...html.matchAll(/href="\/segments\/([^"]+)"/g)].map((m) => m[1]))];
  slugs.sort((a, b) => segmentPriority(a) - segmentPriority(b));
  return slugs.map((s) => `https://freshairarchive.org/segments/${s}`);
}

const subjects = flag("--subject") ? [flag("--subject")]
  : flag("--subjects") ? flag("--subjects").split("|").map((s) => s.trim()).filter(Boolean)
  : args.includes("--corpus") ? (await listSubjects()).filter((s) => s.kind === "person" || s.kind === "group").map((s) => s.name)
  : [];

try {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  if (!subjects.length) {
    console.log('usage: --subject "Name" | --subjects "A|B|C" | --corpus  [--segments N] [--model sonnet|fable|haiku]');
    process.exit(0);
  }

  let confirmed = 0, rejected = 0, dropped = 0, harvested = 0, guestsFound = 0;
  const touched = new Set();

  for (const name of subjects) {
    let urls;
    try {
      urls = await guestSegments(name);
    } catch (err) {
      console.log(`\n▸ ${name} — ✗ guest lookup failed: ${err.message}`);
      continue;
    }
    if (!urls) continue; // silent skip: most of the corpus was never on Fresh Air
    if (!urls.length) { console.log(`\n▸ ${name} — guest page exists but lists no segments`); continue; }
    guestsFound += 1;
    console.log(`\n▸ ${name} — ${urls.length} segment(s), harvesting up to ${maxSegments}`);

    let done = 0;
    for (const url of urls) {
      if (done >= maxSegments) break;
      const already = await q(
        `SELECT 1 FROM provenance p JOIN claims c ON c.id = p.claim_id
         WHERE c.agent_run_id LIKE 'harvest%' AND p.source_url = $1 LIMIT 1`,
        [url]
      );
      if (already.rows[0]) { console.log(`  ⊘ already harvested: ${url}`); continue; }

      await pause(400);
      try {
        const s = await harvestSource(url, { model, log: console.log });
        if (s.error) { console.log(`  ✗ ${s.error}`); continue; }
        done += 1;
        harvested += 1;
        confirmed += s.confirmed; rejected += s.rejected; dropped += s.dropped || 0;
        s.subjects.forEach((x) => touched.add(x));
        console.log(`  → ${s.confirmed} confirmed / ${s.rejected} rejected / ${s.dropped || 0} shape-dropped (${url.split("/").pop()})`);
      } catch (err) {
        console.log(`  ✗ harvest failed: ${err.message}`);
      }
    }
  }

  const { totalUsd, byLabel } = usageSummary();
  console.log(`\n═══ FRESH AIR HARVEST LEDGER ═══`);
  console.log(`guests found: ${guestsFound}/${subjects.length} | transcripts harvested: ${harvested} | confirmed: ${confirmed} / rejected: ${rejected} / shape-dropped: ${dropped} | entities touched: ${touched.size}`);
  for (const [label, s] of Object.entries(byLabel)) {
    console.log(`  ${label}: ${s.calls} call(s), ${(s.in / 1000).toFixed(1)}k in / ${(s.out / 1000).toFixed(1)}k out → $${s.usd.toFixed(3)}`);
  }
  console.log(`TOTAL: $${totalUsd.toFixed(3)}${confirmed ? ` | $${(totalUsd / confirmed).toFixed(3)} per confirmed citation` : ""}`);
  const { recordSpend } = await import("../src/lib/spend.js");
  recordSpend(path.join(path.dirname(fileURLToPath(import.meta.url)), ".."), "harvest-freshair", totalUsd, `${harvested} transcript(s) across ${guestsFound} guest(s), ${confirmed} confirmed`);
} catch (err) {
  console.error("error:", err.message);
  process.exitCode = 1;
} finally {
  await getPool()?.end();
}
