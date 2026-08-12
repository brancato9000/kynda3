#!/usr/bin/env node
// Quote-context backfill (Tony, 2026-08-11): every verified quote gets the
// sentences around it — deterministically. The wall proved the quote is in
// the page; this refetches the page, locates the quote with a whitespace-
// flexible pattern, and captures ~a sentence before and after. Verbatim
// source text, no model, no invention.
//
//   node scripts/backfill-context.mjs [--dry] [--limit N]

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

const { q, getPool } = await import("../src/lib/db.js");
const { fetchPageText } = await import("../src/lib/verify/evidence.js");

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const dry = process.argv.includes("--dry");
const lFlag = process.argv.indexOf("--limit");
const LIMIT = lFlag === -1 ? null : parseInt(process.argv[lFlag + 1], 10);

/** Locate the quote in the ORIGINAL text: escape tokens, allow flexible
 * whitespace/punctuation spacing between words, case-insensitive. */
function locate(text, quote) {
  const words = quote.split(/\s+/).filter(Boolean).slice(0, 40);
  if (words.length < 4) return null;
  const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\u00A0]+");
  try {
    const re = new RegExp(pattern, "i");
    const m = re.exec(text);
    return m ? { start: m.index, end: m.index + m[0].length } : null;
  } catch {
    return null;
  }
}

/** Grab up to ~260 chars before/after, snapped to sentence-ish boundaries. */
function contextAround(text, start, end) {
  let before = text.slice(Math.max(0, start - 400), start);
  let after = text.slice(end, end + 400);
  const bMatch = before.match(/(?:^|[.!?]["']?\s+)([^.!?]*(?:[.!?]["']?\s+[^.!?]*){0,1})$/);
  before = (bMatch ? bMatch[1] : before.slice(-260)).trimStart();
  const aMatch = after.match(/^([^.!?]*[.!?]["']?(?:\s+[^.!?]*[.!?]["']?){0,1})/);
  after = (aMatch ? aMatch[1] : after.slice(0, 260)).trimEnd();
  // Don't store trivial fragments.
  if (before.length < 25) before = null;
  if (after.length < 25) after = null;
  return { before, after };
}

const urls = (await q(
  `SELECT source_url, count(*) AS n FROM provenance
   WHERE verification_status = 'quote_confirmed' AND source_url IS NOT NULL
     AND context_before IS NULL AND context_after IS NULL
     AND quote IS NOT NULL
   GROUP BY source_url ORDER BY n DESC ${LIMIT ? `LIMIT ${LIMIT}` : ""}`
)).rows;
console.log(`${urls.length} source pages to fetch${dry ? " (dry)" : ""}`);

let pages = 0, stamped = 0, located = 0, missed = 0;
for (const u of urls) {
  await pause(400);
  let page;
  try { page = await fetchPageText(u.source_url); } catch { continue; }
  if (!page.ok) continue;
  pages += 1;
  const rows = (await q(
    `SELECT id, quote FROM provenance
     WHERE source_url = $1 AND verification_status = 'quote_confirmed'
       AND context_before IS NULL AND context_after IS NULL AND quote IS NOT NULL`,
    [u.source_url]
  )).rows;
  for (const r of rows) {
    const loc = locate(page.text, r.quote);
    if (!loc) { missed += 1; continue; }
    located += 1;
    const ctx = contextAround(page.text, loc.start, loc.end);
    if (!ctx.before && !ctx.after) { missed += 1; continue; }
    stamped += 1;
    if (!dry) {
      await q(`UPDATE provenance SET context_before = $2, context_after = $3 WHERE id = $1`, [
        r.id, ctx.before ? ctx.before.slice(0, 400) : null, ctx.after ? ctx.after.slice(0, 400) : null,
      ]);
    }
  }
  if (pages % 40 === 0) console.log(`  ...${pages}/${urls.length} pages (${stamped} stamped)`);
}
console.log(`pages fetched: ${pages} | quotes located: ${located} | contexts stamped: ${stamped} | not locatable: ${missed}`);
await getPool().end();
