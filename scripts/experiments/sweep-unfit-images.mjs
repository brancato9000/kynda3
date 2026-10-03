#!/usr/bin/env node
// One-time sweep (2026-10-02): find stored Commons pictures that the new
// unfitImage gate would refuse (wordmarks and banners, wider than 3:1) — The
// Chronic's 693×48 wordmark showed up as a fragment in Kendrick Lamar's map.
// The gate is shape only: more than 3:1 wide.
// Offenders are stripped WITHOUT a settled status, so the zero-model-call
// backfill (scripts/map-images.mjs) can look again under the new gate.
//
//   node scripts/experiments/sweep-unfit-images.mjs           dry run
//   node scripts/experiments/sweep-unfit-images.mjs --apply   strip
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
try {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".env.local");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* env */ }
const { q, getPool } = await import("../../src/lib/db.js");
const { unfitImage, UA } = await import("../../src/lib/pipeline/media.js");
const APPLY = process.argv.includes("--apply");

const rows = (await q(`SELECT id, name, metadata->>'image_page' AS page, metadata->>'image_status' AS status
  FROM entities WHERE metadata->>'image_page' LIKE 'https://commons.wikimedia.org/wiki/File:%'`)).rows;
const byFile = new Map();
for (const r of rows) {
  const f = decodeURIComponent(r.page.split("/wiki/")[1]).replace(/_/g, " ");
  (byFile.get(f) || byFile.set(f, []).get(f)).push(r);
}
const files = [...byFile.keys()];
const bad = [];
for (let i = 0; i < files.length; i += 40) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  for (const [k, v] of Object.entries({ action: "query", titles: files.slice(i, i + 40).join("|"), prop: "imageinfo", iiprop: "size", format: "json" })) u.searchParams.set(k, v);
  const d = await (await fetch(u, { headers: UA })).json();
  const norm = Object.fromEntries((d.query?.normalized || []).map((n) => [n.to, n.from]));
  for (const p of Object.values(d.query?.pages || {})) {
    const ii = p.imageinfo?.[0]; if (!ii || !unfitImage(ii)) continue;
    const f = norm[p.title] || p.title;
    for (const r of byFile.get(f) || []) bad.push({ ...r, file: f, size: `${ii.width}×${ii.height}`, curated: r.status === "approved" });
  }
  await new Promise((r) => setTimeout(r, 150));
}
for (const b of bad) console.log(`  ${b.name} — ${b.file} (${b.size})${b.curated ? " [curator-approved: left alone]" : ""}`);
console.log(`${rows.length} Commons pictures checked; ${bad.length} unfit${APPLY ? "" : " (dry run; --apply to strip)"}`);
if (APPLY) {
  const ids = bad.filter((b) => !b.curated).map((b) => b.id);
  await q(`UPDATE entities SET metadata = metadata - 'image_url' - 'image_page' - 'image_license' - 'image_credit' - 'image_source' - 'image_identity' - 'image_fair_use' - 'image_status', updated_at = now()
           WHERE id = ANY($1::uuid[])`, [ids]);
  console.log(`stripped ${ids.length}`);
}
await getPool().end();
