#!/usr/bin/env node
// Curator review CLI (V3-26, interim until the review UI exists).
//
//   node scripts/contributions.js                 list pending
//   node scripts/contributions.js --all           list everything
//   node scripts/contributions.js --resolve <id>  mark a flag resolved / evidence reviewed

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

const { q, getPool } = await import("../src/lib/db.js");

const args = process.argv.slice(2);
const resolveId = args.includes("--resolve") ? args[args.indexOf("--resolve") + 1] : null;

try {
  if (resolveId) {
    await q("UPDATE contributions SET status = 'resolved' WHERE id = $1", [resolveId]);
    console.log("resolved", resolveId);
  } else {
    const all = args.includes("--all");
    const r = await q(
      `SELECT id, kind, status, subject_name, item_title, contributor, comment, url, quote, created_at
       FROM contributions ${all ? "" : "WHERE status IN ('pending','confirmed')"} ORDER BY created_at DESC LIMIT 50`
    );
    if (!r.rows.length) console.log("no contributions" + (all ? "" : " pending review"));
    for (const c of r.rows) {
      console.log(`\n[${c.kind.toUpperCase()} · ${c.status}] ${c.id}`);
      console.log(`  ${c.subject_name}${c.item_title ? ` → ${c.item_title}` : ""} | by ${c.contributor || "anonymous"} | ${new Date(c.created_at).toISOString().slice(0, 16)}`);
      if (c.comment) console.log(`  comment: ${c.comment}`);
      if (c.quote) console.log(`  quote: "${c.quote.slice(0, 120)}${c.quote.length > 120 ? "…" : ""}"`);
      if (c.url) console.log(`  url: ${c.url}`);
    }
  }
} finally {
  await getPool()?.end();
}
