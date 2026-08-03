#!/usr/bin/env node
// Demo-page visit report (V3-66): did Sydney open the links?
//
//   node scripts/visits.mjs            all logged visits, newest first
//   node scripts/visits.mjs --today

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
const today = process.argv.includes("--today") ? "AND ts::date = now()::date" : "";
const rows = (await q(`SELECT path, ts, user_agent, referer, ip_hash FROM page_views WHERE true ${today} ORDER BY ts DESC LIMIT 200`)).rows;

if (!rows.length) { console.log("no visits logged yet"); }
else {
  const byPath = {};
  for (const r of rows) (byPath[r.path] ||= []).push(r);
  for (const [p, xs] of Object.entries(byPath)) {
    const visitors = new Set(xs.map((x) => x.ip_hash).filter(Boolean)).size;
    console.log(`\n${p} — ${xs.length} view(s), ~${visitors} distinct visitor(s)`);
    for (const x of xs.slice(0, 10)) {
      const device = /mobile|iphone|android/i.test(x.user_agent || "") ? "mobile" : /bot|crawler|spider|preview|facebookexternalhit|slack|whatsapp/i.test(x.user_agent || "") ? "BOT/preview" : "desktop";
      console.log(`  ${x.ts.toISOString().replace("T", " ").slice(0, 16)}  ${device}  visitor:${x.ip_hash || "?"}${x.referer ? `  via ${x.referer}` : ""}`);
    }
  }
}
await getPool().end();
