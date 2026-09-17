// Smoke test for named subjects: stored-mix health — cards per slot,
// verification tiers, media coverage. Read-only.
//   node scripts/experiments/smoke-subjects.mjs "The Glass Bead Game" "Detroit-style pizza"
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
  if (!s) { console.log(`\n✗ ${name}: NO SUBJECT`); continue; }
  const mix = await getStoredMix(s);
  if (!mix) { console.log(`\n✗ ${name}: NO STORED MIX`); continue; }
  console.log(`\n═══ ${s.name}`);
  console.log(`intro: ${(mix.intro || "").slice(0, 140)}…`);
  let cards = 0, verified = 0, documented = 0, art = 0, preview = 0;
  for (const slot of mix.slots || []) {
    const titles = [];
    for (const c of slot.candidates || []) {
      cards += 1;
      const a = c.verification?.attribution?.status, con = c.verification?.connection?.status;
      if (a === "verified") verified += 1;
      if ((con || "").startsWith("documented")) documented += 1;
      const media = await getCardMedia(c.item).catch(() => null);
      if (c.item?.imageUrl || media?.imageUrl) art += 1;
      if (media?.previewUrl) preview += 1;
      titles.push(`${c.item?.title}${a === "verified" ? "✓" : ""}`);
    }
    console.log(`  ${slot.slotType}: ${titles.join(" | ")}`);
  }
  console.log(`  → ${cards} cards · attr-verified ${verified} · conn-documented ${documented} · art ${art} · previews ${preview}`);
}
await getPool().end();
