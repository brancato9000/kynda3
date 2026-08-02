#!/usr/bin/env node
// Admin domain override (V3-53): pin an entity's browsing domain against
// the occupation-derived classification. Overrides survive every
// classify-entities re-run — hygiene never writes domain where one is set.
//
//   node scripts/override-domain.mjs "Garry Marshall" television
//   node scripts/override-domain.mjs --clear "Garry Marshall"   # next classify run recomputes
//   node scripts/override-domain.mjs --list
//   node scripts/override-domain.mjs --id 42 television         # when a name is ambiguous

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

const DOMAINS = new Set([
  "music", "film", "television", "literature", "art", "design",
  "architecture", "theater", "dance", "fashion", "other",
]);

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return null;
  return args.splice(i, name === "--list" || name === "--clear" ? 1 : 2)[1] ?? true;
};
const list = flag("--list");
const clear = flag("--clear");
const id = flag("--id");

if (list) {
  const r = await q(`SELECT id, name, kind, domain, domain_override FROM entities WHERE domain_override IS NOT NULL ORDER BY name`);
  for (const e of r.rows) console.log(`  #${e.id} ${e.name} (${e.kind}) → ${e.domain_override}`);
  if (!r.rows.length) console.log("no overrides set");
  await getPool().end();
  process.exit(0);
}

const [name, domain] = clear ? [args[0], null] : [id ? null : args[0], args[id ? 0 : 1]];
if ((!name && !id) || (!clear && !DOMAINS.has(domain))) {
  console.error(`usage: override-domain.mjs <name> <domain> | --id <id> <domain> | --clear <name> | --list\ndomains: ${[...DOMAINS].join(", ")}`);
  process.exit(1);
}

const matches = id
  ? await q(`SELECT id, name, kind, domain, domain_override FROM entities WHERE id = $1`, [id])
  : await q(`SELECT id, name, kind, domain, domain_override FROM entities WHERE lower(name) = lower($1) ORDER BY created_at`, [name]);
if (!matches.rows.length) {
  console.error(`no entity ${id ? `#${id}` : `named "${name}"`}`);
  process.exit(1);
}
if (matches.rows.length > 1) {
  console.error(`"${name}" is ambiguous — pick one with --id:`);
  for (const e of matches.rows) console.error(`  #${e.id} ${e.name} (${e.kind}/${e.domain})`);
  process.exit(1);
}

const e = matches.rows[0];
if (clear) {
  await q(`UPDATE entities SET domain_override = NULL WHERE id = $1`, [e.id]);
  console.log(`cleared override on ${e.name} (domain stays ${e.domain} until the next classify run)`);
} else {
  await q(`UPDATE entities SET domain = $2, domain_override = $2 WHERE id = $1`, [e.id, domain]);
  console.log(`${e.name}: ${e.domain} → ${domain} (pinned)`);
}
await getPool().end();
