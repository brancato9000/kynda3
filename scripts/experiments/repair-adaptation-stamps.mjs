// Adaptation-stamp repair (2026-09-22, Going All the Way autopsy): a
// literature card wearing a film/TV asset, or a film card labeled as a
// book jacket. Two smells, one pass: (1) class label disagrees with the
// card's medium; (2) literature cards whose image FILENAME says poster /
// movie / film / DVD / title card / Netflix / teaser. Film cards whose
// image is plainly a poster get RELABELED (V3-74); literature cards with
// film/TV assets are STRIPPED so the medium-aware lookup can re-find the
// book. Prints every change; --dry to preview.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of readFileSync(`${ROOT}/.env.local`, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { q, getPool } = await import(`${ROOT}/src/lib/db.js`);
const DRY = process.argv.includes("--dry");
const FILMISH = /poster|movie|film|dvd|title_card|titlecard|netflix|teaser|screenshot/i;
const POSTER = "fair use — film poster thumbnail (class rule V3-74)";
const rows = (await q(`SELECT m.id, e.name, m.payload FROM mixes m JOIN entities e ON e.id = m.subject_entity_id WHERE m.created_at > now() - interval '180 days'`)).rows;
const touched = new Set();
let stripped = 0, relabeled = 0;
for (const r of rows) {
  let dirty = false;
  for (const s of r.payload.slots || []) for (const c of s.candidates || []) {
    const it = c.item || {};
    if (!it.imageUrl || !/^fair use/.test(it.imageLicense || "")) continue;
    const file = decodeURIComponent(it.imageUrl.split("?")[0].split("/").pop() || "");
    const lic = it.imageLicense;
    const litCard = it.medium === "literature";
    const filmCard = it.medium === "film";
    if (litCard && (/(poster|TV title)/.test(lic) || FILMISH.test(file))) {
      console.log(`  strip   ${r.name} | ${it.title} — ${it.creator} | ${file}`);
      for (const k of ["imageUrl", "imagePage", "imageCredit", "imageLicense"]) delete it[k];
      stripped += 1; dirty = true; touched.add(r.name);
    } else if (filmCard && /jacket/.test(lic) && FILMISH.test(file)) {
      console.log(`  relabel ${r.name} | ${it.title} — ${it.creator} | ${file}`);
      it.imageLicense = POSTER; relabeled += 1; dirty = true;
    } else if (filmCard && /jacket/.test(lic)) {
      console.log(`  strip   ${r.name} | ${it.title} — ${it.creator} | ${file} (film card, jacket class, unclear asset)`);
      for (const k of ["imageUrl", "imagePage", "imageCredit", "imageLicense"]) delete it[k];
      stripped += 1; dirty = true; touched.add(r.name);
    }
  }
  if (dirty && !DRY) await q(`UPDATE mixes SET payload = $2 WHERE id = $1`, [r.id, JSON.stringify(r.payload)]);
}
console.log(`\nstripped ${stripped} | relabeled ${relabeled}${DRY ? " (dry)" : ""}`);
console.log(`subjects to re-run: ${[...touched].map((n) => JSON.stringify(n)).join(" ")}`);
await getPool().end();
