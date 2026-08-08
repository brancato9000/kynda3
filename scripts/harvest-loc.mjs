#!/usr/bin/env node
// Library of Congress harvester (prototype, 2026-08-07) — Chronicling
// America, the full-text-searchable historic newspaper corpus. The first
// non-web source class: dated primary coverage of exactly the artists the
// open web undersells (pre-1963, heavily the historic Black press).
//
//   node scripts/harvest-loc.mjs --subject "Katherine Dunham"
//   node scripts/harvest-loc.mjs --subjects "A|B|C"   (pipe-separated)
//   [--pages N]   newspaper pages harvested per subject (default 3)
//   [--model sonnet|fable|haiku]                      (default sonnet)
//
// Flow per subject: phrase-search the collection API (free, no key) →
// take relevance-ranked pages → pull the OCR full text from LoC's text
// service → run the standard harvest core (extraction + shape gates +
// quote wall) over text we hold. Publication and publish DATE come from
// the API deterministically — every citation lands dated, feeding the
// influence-over-time methodology directly. Quotes are verified against
// the same OCR the model read, so OCR errors don't break the quote wall
// (the stored quote carries them verbatim — honest, if occasionally ugly).

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

const { harvestText } = await import("../src/lib/pipeline/harvest.js");
const { normalizeText } = await import("../src/lib/verify/quoteMatch.js");
const { usageSummary } = await import("../src/lib/ai/anthropic.js");
const { q, getPool } = await import("../src/lib/db.js");

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const MODELS = { sonnet: "claude-sonnet-5", fable: "claude-fable-5", haiku: "claude-haiku-4-5" };
const model = MODELS[flag("--model")] || MODELS.sonnet;
const pagesPer = parseInt(flag("--pages"), 10) || 3;
const subjects = flag("--subject") ? [flag("--subject")]
  : flag("--subjects") ? flag("--subjects").split("|").map((s) => s.trim()).filter(Boolean)
  : [];

const UA = { "User-Agent": "Kynda/3.0 (kynda3.vercel.app; brancato@gmail.com)" };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// LoC's tile/text services drop connections under load ("terminated") —
// one patient retry recovers nearly all of them.
const locFetch = async (url) => {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(`LoC ${r.status}`);
      return r;
    } catch (err) {
      if (attempt >= 2) throw err;
      await pause(2000 * (attempt + 1));
    }
  }
};
const locJson = async (url) => (await locFetch(url)).json();

/** Phrase-search Chronicling America; q= honors quoted phrases (qs= does not). */
async function searchPages(name, count) {
  const u = `https://www.loc.gov/collections/chronicling-america/?q=${encodeURIComponent(`"${name}"`)}&fo=json&c=${count}`;
  const d = await locJson(u);
  return { total: d.pagination?.of || 0, results: d.results || [] };
}

/** Pull OCR full text for one search result via LoC's text service. */
async function pageText(result) {
  const jsonUrl = result.id.replace(/^http:/, "https:") + (result.id.includes("?") ? "&" : "?") + "fo=json";
  const d = await locJson(jsonUrl);
  const svc = d.resources?.[0]?.fulltext_file;
  if (!svc) return null;
  const raw = await (await locFetch(svc)).text();
  try {
    const j = JSON.parse(raw);
    const seg = Object.values(j)[0];
    return seg?.full_text || null;
  } catch {
    return raw.length > 500 ? raw : null; // plain-text fallback
  }
}

/** "the monitor (omaha, neb.) 1915-1928" → "The Monitor (Omaha, Neb.)" */
function cleanPublication(partof) {
  const s = (partof || "").replace(/\s+\d{4}-(\d{4}|\?+|current)?\s*$/i, "").trim();
  return s.replace(/\b([a-z])(\w*)/g, (_, a, rest) => a.toUpperCase() + rest) || "Chronicling America";
}

try {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  if (!subjects.length) {
    console.log('usage: --subject "Name" | --subjects "A|B|C"  [--pages N] [--model sonnet|fable|haiku]');
    process.exit(0);
  }

  let confirmed = 0, rejected = 0, dropped = 0, harvested = 0;
  const touched = new Set();

  for (const name of subjects) {
    console.log(`\n▸ ${name} — searching Chronicling America`);
    // One subject's dead search must not kill a 55-subject run — log and
    // move on; re-running the same roster resumes (harvested URLs skip).
    let total, results;
    try {
      ({ total, results } = await searchPages(name, pagesPer * 4));
    } catch (err) {
      console.log(`  ✗ search failed: ${err.message}`);
      continue;
    }
    console.log(`  ${total} newspaper page(s) mention the phrase; trying top ${Math.min(results.length, pagesPer * 4)} for ${pagesPer} harvest(s)`);

    let done = 0;
    for (const r of results) {
      if (done >= pagesPer) break;
      const url = r.id.replace(/^http:/, "https:");
      const already = await q(
        `SELECT 1 FROM provenance p JOIN claims c ON c.id = p.claim_id
         WHERE c.agent_run_id LIKE 'harvest%' AND p.source_url = $1 LIMIT 1`,
        [url]
      );
      if (already.rows[0]) { console.log(`  ⊘ already harvested: ${url}`); continue; }

      await pause(600); // stay well under LoC rate limits
      let text;
      try { text = await pageText(r); } catch (err) { console.log(`  ✗ text fetch failed: ${err.message}`); continue; }
      if (!text) { console.log(`  ⊘ no OCR text: ${url}`); continue; }
      // The search index can hit fuzzier than the OCR reads — require the
      // subject to actually appear in the text we hold before spending.
      if (!normalizeText(text).includes(normalizeText(name))) {
        console.log(`  ⊘ subject not verbatim in OCR (index fuzz): ${url}`);
        continue;
      }

      const publication = cleanPublication(r.partof_title?.[0]);
      console.log(`  ▸ ${publication} — ${r.date} (${(text.length / 1000).toFixed(0)}k chars OCR)`);
      let s;
      try {
        s = await harvestText({
        url,
        text,
        model,
        publication,
        publishedDate: r.date || "",
        sourceNote:
          "This is OCR text of ONE full historic newspaper page (many unrelated articles and ads; OCR errors are possible). Extract only explicitly stated cultural connections. Quotes must be VERBATIM from this OCR text, including any OCR errors — they are machine-checked against it.",
        log: console.log,
        });
      } catch (err) {
        console.log(`  ✗ harvest failed: ${err.message}`);
        continue;
      }
      done += 1;
      harvested += 1;
      confirmed += s.confirmed; rejected += s.rejected; dropped += s.dropped || 0;
      s.subjects.forEach((x) => touched.add(x));
      console.log(`    → ${s.confirmed} confirmed / ${s.rejected} rejected / ${s.dropped || 0} shape-dropped`);
    }
    if (!done) console.log(`  (no harvestable pages for ${name})`);
  }

  const { totalUsd, byLabel } = usageSummary();
  console.log(`\n═══ LOC HARVEST LEDGER ═══`);
  console.log(`pages harvested: ${harvested} | confirmed: ${confirmed} / rejected: ${rejected} / shape-dropped: ${dropped} | entities touched: ${touched.size}`);
  for (const [label, s] of Object.entries(byLabel)) {
    console.log(`  ${label}: ${s.calls} call(s), ${(s.in / 1000).toFixed(1)}k in / ${(s.out / 1000).toFixed(1)}k out → $${s.usd.toFixed(3)}`);
  }
  console.log(`TOTAL: $${totalUsd.toFixed(3)}${confirmed ? ` | $${(totalUsd / confirmed).toFixed(3)} per confirmed citation` : ""}`);
  const { recordSpend } = await import("../src/lib/spend.js");
  recordSpend(path.join(path.dirname(fileURLToPath(import.meta.url)), ".."), "harvest-loc", totalUsd, `${harvested} ChronAm page(s), ${confirmed} confirmed`);
} catch (err) {
  console.error("error:", err.message);
  process.exitCode = 1;
} finally {
  await getPool()?.end();
}
