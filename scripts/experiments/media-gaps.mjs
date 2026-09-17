// Lists the cards on named subjects that carry no image or preview. Read-only.
//   node scripts/experiments/media-gaps.mjs "David Bowie" "Dave Chappelle"
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of readFileSync(`${ROOT}/.env.local`, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { getPool } = await import(`${ROOT}/src/lib/db.js`);
const { listSubjects, getStoredMix, getCardMedia } = await import(`${ROOT}/src/lib/store.js`);
const subjects = await listSubjects();
for (const name of process.argv.slice(2)) {
  const s = subjects.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!s) { console.log(`\n✗ ${name}: no subject`); continue; }
  const mix = await getStoredMix(s);
  let have = 0, total = 0;
  console.log(`\n═══ ${s.name}`);
  for (const slot of mix.slots) for (const c of slot.candidates) {
    total += 1;
    const m = await getCardMedia(c.item).catch(() => null);
    const has = c.item.imageUrl || m?.imageUrl || m?.previewUrl;
    if (has) have += 1;
    else console.log(`  ∅ [${slot.slotType}] ${c.item.title} — ${c.item.creator} (${c.item.year || "?"}, ${c.item.medium || "?"})`);
  }
  console.log(`  → ${have}/${total} cards carry media`);
}
await getPool().end();
