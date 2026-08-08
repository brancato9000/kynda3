#!/usr/bin/env node
// AAPB harvester (2026-08-08) — the American Archive of Public Broadcasting
// (LoC + GBH): digitized public TV and radio back decades, with transcripts
// SERVER-RENDERED INLINE in item pages (validated: cpb-aacip-529-pc2t43kf46,
// a 1988 Longhorn Radio "Forum" special on Merce Cunningham). Recipe teed
// up in backlog.tsv; every endpoint probed live before this was written.
//
//   node scripts/harvest-aapb.mjs --subject "Merce Cunningham"
//   node scripts/harvest-aapb.mjs --subjects "A|B|C"
//   node scripts/harvest-aapb.mjs --corpus
//   [--items N]   max items harvested per subject (default 3)
//   [--model sonnet|fable|haiku]                  (default sonnet)
//
// Flow per subject: Solr search filtered to online items → skip items
// already harvested or without an inline transcript → require the subject
// verbatim in the page text (search hits metadata too) → harvestText with
// publication (series title) and broadcast date passed DETERMINISTICALLY
// from the PBCore metadata, so citations land dated like LoC's.

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
const { htmlToText } = await import("../src/lib/verify/evidence.js");
const { normalizeText } = await import("../src/lib/verify/quoteMatch.js");
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
const itemsPer = parseInt(flag("--items"), 10) || 3;

const UA = { "User-Agent": "Mozilla/5.0 (compatible; Kynda/3.0; brancato@gmail.com)" };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const aapbFetch = async (url) => {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(`AAPB ${r.status}`);
      return r;
    } catch (err) {
      if (attempt >= 2) throw err;
      await pause(2000 * (attempt + 1));
    }
  }
};

async function searchOnline(name, rows) {
  const u = `https://americanarchive.org/api.json?q=${encodeURIComponent(`"${name}"`)}&fq=access_types:online&rows=${rows}`;
  const d = await (await aapbFetch(u)).json();
  return { total: d.response?.numFound || 0, docs: d.response?.docs || [] };
}

/** Broadcast date out of the doc's inline PBCore xml; "" when absent. */
function broadcastDate(xml) {
  const s = String(xml || "");
  const typed = s.match(/<pbcoreAssetDate[^>]*dateType="broadcast"[^>]*>([^<]+)</i)?.[1];
  const any = typed || s.match(/<pbcoreAssetDate[^>]*>([^<]+)</i)?.[1] || "";
  const iso = any.match(/\d{4}(-\d{2}(-\d{2})?)?/)?.[0] || "";
  return iso;
}

/** "Forum; Merce Cunningham: A Celebration" → "Forum" */
function seriesTitle(title) {
  const t = Array.isArray(title) ? title[0] : title;
  return String(t || "").split(";")[0].trim() || "public broadcasting";
}

const subjects = flag("--subject") ? [flag("--subject")]
  : flag("--subjects") ? flag("--subjects").split("|").map((s) => s.trim()).filter(Boolean)
  : args.includes("--corpus") ? (await listSubjects()).filter((s) => s.kind === "person" || s.kind === "group").map((s) => s.name)
  : [];

try {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  if (!subjects.length) {
    console.log('usage: --subject "Name" | --subjects "A|B|C" | --corpus  [--items N] [--model sonnet|fable|haiku]');
    process.exit(0);
  }

  let confirmed = 0, rejected = 0, dropped = 0, harvested = 0;
  const touched = new Set();

  for (const name of subjects) {
    console.log(`\n▸ ${name} — searching AAPB (online items)`);
    let total, docs;
    try {
      ({ total, docs } = await searchOnline(name, itemsPer * 5));
    } catch (err) {
      console.log(`  ✗ search failed: ${err.message}`);
      continue;
    }
    if (!total) { console.log("  (no online items)"); continue; }
    console.log(`  ${total} online item(s); trying top ${docs.length} for ${itemsPer} harvest(s)`);

    let done = 0;
    for (const doc of docs) {
      if (done >= itemsPer) break;
      const url = `https://americanarchive.org/catalog/${doc.id}`;
      const already = await q(
        `SELECT 1 FROM provenance p JOIN claims c ON c.id = p.claim_id
         WHERE c.agent_run_id LIKE 'harvest%' AND p.source_url = $1 LIMIT 1`,
        [url]
      );
      if (already.rows[0]) { console.log(`  ⊘ already harvested: ${url}`); continue; }

      await pause(500);
      let html;
      try { html = await (await aapbFetch(url)).text(); } catch (err) { console.log(`  ✗ page fetch failed: ${err.message}`); continue; }
      if (!/class="[^"]*transcript-content/.test(html)) { console.log(`  ⊘ no inline transcript: ${url}`); continue; }
      const text = htmlToText(html);
      if (!normalizeText(text).includes(normalizeText(name))) {
        console.log(`  ⊘ subject only in metadata, not transcript: ${url}`);
        continue;
      }

      const publication = `${seriesTitle(doc.title)} (public broadcasting)`;
      const date = broadcastDate(doc.xml);
      console.log(`  ▸ ${publication} — ${date || "undated"} (${(text.length / 1000).toFixed(0)}k chars)`);
      let s;
      try {
        s = await harvestText({
          url,
          text,
          model,
          publication,
          publishedDate: date,
          sourceNote:
            "This is the page of a digitized public radio/TV program with its full transcript inline (program metadata precedes it; transcripts may contain transcription errors). Extract only explicitly stated cultural connections. Quotes must be VERBATIM from this text — they are machine-checked against it.",
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
    if (!done) console.log(`  (no harvestable items for ${name})`);
  }

  const { totalUsd, byLabel } = usageSummary();
  console.log(`\n═══ AAPB HARVEST LEDGER ═══`);
  console.log(`items harvested: ${harvested} | confirmed: ${confirmed} / rejected: ${rejected} / shape-dropped: ${dropped} | entities touched: ${touched.size}`);
  for (const [label, s] of Object.entries(byLabel)) {
    console.log(`  ${label}: ${s.calls} call(s), ${(s.in / 1000).toFixed(1)}k in / ${(s.out / 1000).toFixed(1)}k out → $${s.usd.toFixed(3)}`);
  }
  console.log(`TOTAL: $${totalUsd.toFixed(3)}${confirmed ? ` | $${(totalUsd / confirmed).toFixed(3)} per confirmed citation` : ""}`);
  const { recordSpend } = await import("../src/lib/spend.js");
  recordSpend(path.join(path.dirname(fileURLToPath(import.meta.url)), ".."), "harvest-aapb", totalUsd, `${harvested} AAPB item(s), ${confirmed} confirmed`);
} catch (err) {
  console.error("error:", err.message);
  process.exitCode = 1;
} finally {
  await getPool()?.end();
}
