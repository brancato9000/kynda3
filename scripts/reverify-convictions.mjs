#!/usr/bin/env node
// Conviction re-check (V3-59): the Andreae lesson — exact-label matching
// convicted "Johann Valentin Andreae" because Wikidata's canonical label is
// the Latinized "Johannes Valentinus Andreae". The matcher now reads
// aliases and tolerates Latinized token variants, and a near-name never
// convicts. This sweep re-runs verifyAttribution over every stored
// CONVICTION (detail contains "credits") and patches payloads in place.
// Zero tokens; idempotent.
//
//   node scripts/reverify-convictions.mjs [--dry]

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
const { q, getPool } = await import("../src/lib/db.js");
const DRY = process.argv.includes("--dry");

const mixes = await q(`
  SELECT m.id, e.name AS subject, m.payload FROM mixes m
  JOIN entities e ON e.id = m.subject_entity_id`);

let checked = 0, healed = 0, upheld = 0;
for (const row of mixes.rows) {
  const slots = row.payload.slots;
  if (!slots) continue; // legacy payloads
  let dirty = false;
  for (const slot of slots) {
    for (const cand of slot.candidates || []) {
      const att = cand?.verification?.attribution;
      if (!att || att.status !== "not_found" || !/credits/i.test(att.detail || "")) continue;
      checked += 1;
      const fresh = await verifyAttribution(cand.item).catch(() => null);
      if (!fresh) continue;
      const stillConvicted = fresh.status === "not_found" && /credits/i.test(fresh.detail || "");
      if (stillConvicted) { upheld += 1; continue; }
      healed += 1;
      console.log(`  ${row.subject} → "${cand.item.title}" (${cand.item.creator}): conviction → ${fresh.status}${fresh.detail ? ` [${fresh.detail}]` : ""}`);
      cand.verification.attribution = fresh;
      dirty = true;
    }
  }
  if (dirty && !DRY) {
    await q("UPDATE mixes SET payload = $2 WHERE id = $1", [row.id, JSON.stringify(row.payload)]);
  }
}
console.log(`${checked} convictions checked | ${upheld} upheld | ${healed} ${DRY ? "would heal" : "healed"}`);
await getPool().end();
