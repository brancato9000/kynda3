#!/usr/bin/env node
// Retroactive film/TV re-verification (V3-46): sweep every stored mix and
// recompute attribution for film/television candidates against TMDb —
// upgrading "skipped/unchecked" to real verdicts, and honestly downgrading
// anything a real catalog convicts. Patches payloads in place; zero tokens.

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

const { verifyAttribution } = await import("../src/lib/pipeline/mix.js");
const { tmdbConfigured } = await import("../src/lib/entities/tmdb.js");
const { q, getPool } = await import("../src/lib/db.js");

if (!tmdbConfigured()) { console.error("KYNDA_TMDB_KEY/TOKEN missing"); process.exit(1); }

const mixes = await q(`
  SELECT m.id, e.name AS subject, m.payload FROM mixes m
  JOIN entities e ON e.id = m.subject_entity_id ORDER BY m.created_at`);

let checked = 0, upgraded = 0, downgraded = 0, confirmed = 0;
for (const row of mixes.rows) {
  const slots = row.payload.slots;
  if (!slots) continue; // legacy payloads
  let touched = false;
  for (const slot of slots) {
    for (const cand of slot.candidates || []) {
      const item = cand.item;
      if (!item || (item.medium !== "film" && item.medium !== "television")) continue;
      const prior = cand.verification?.attribution?.status || "none";
      const fresh = await verifyAttribution(item);
      checked += 1;
      await new Promise((r) => setTimeout(r, 250));
      if (fresh.status === prior && prior !== "verified") continue;
      if (fresh.status === "verified" && prior !== "verified") upgraded += 1;
      else if (fresh.status === "not_found" && prior === "verified") downgraded += 1;
      else if (fresh.status === "verified") confirmed += 1;
      cand.verification = { ...cand.verification, attribution: fresh };
      touched = true;
      const mark = fresh.status === "verified" ? "✓" : fresh.status === "not_found" ? "✕" : "·";
      if (fresh.status !== prior) console.log(`  ${mark} [${row.subject}] ${item.title} — ${item.creator}: ${prior} → ${fresh.status}${fresh.detail ? ` (${fresh.detail})` : ""}`);
    }
  }
  if (touched) {
    await q("UPDATE mixes SET payload = $2 WHERE id = $1", [row.id, JSON.stringify(row.payload)]);
  }
}
console.log(`\ndone: ${checked} film/TV candidates checked | ${upgraded} upgraded to verified | ${downgraded} downgraded to failed | ${confirmed} re-confirmed`);
await getPool().end();
