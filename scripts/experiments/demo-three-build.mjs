// Three demo pages (Tony, 2026-09-14): David Bowie, Dave Chappelle,
// Ghostbusters (1984). Bowie and Chappelle already hold full-stack mixes
// (24 and 22 cards, legacy last) — kept, not regenerated. Ghostbusters is
// new: QID-first (V3-80), Wikipedia harvest, Opus mix, verification. Then
// the generation-time media pass (V3-77) runs on all three.
//   node scripts/experiments/demo-three-build.mjs [--media-only]
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of readFileSync(`${ROOT}/.env.local`, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { q, getPool } = await import(`${ROOT}/src/lib/db.js`);
const { upsertEntity, persistMixRun, listSubjects } = await import(`${ROOT}/src/lib/store.js`);
const { harvestSubjectWikipedia } = await import(`${ROOT}/src/lib/pipeline/harvest.js`);
const { generateMix, loadSubjectArticle, verifyAttribution, verifyConnection } = await import(`${ROOT}/src/lib/pipeline/mix.js`);
const { enrichStoredMixMedia } = await import(`${ROOT}/src/lib/pipeline/media.js`);
const { getIntroExtract } = await import(`${ROOT}/src/lib/entities/wikipedia.js`);
const { usageSummary } = await import(`${ROOT}/src/lib/ai/anthropic.js`);

const SKIP_GEN = process.argv.includes("--media-only");
const QID = "Q108745"; // Ghostbusters, 1984 American comedy film by Ivan Reitman

if (!SKIP_GEN) {
  const id = await upsertEntity({ name: "Ghostbusters", kind: "work", domain: "film", wikidata_qid: QID, year: 1984, metadata: { creator: "Ivan Reitman" } });
  await q(`UPDATE entities SET kind = 'work', domain = 'film', year_start = 1984,
           metadata = metadata || '{"creator":"Ivan Reitman"}'::jsonb WHERE id = $1`, [id]);
  console.log("entity:", id);

  const hw = await harvestSubjectWikipedia({ name: "Ghostbusters", kind: "work", domain: "film", wikidata_qid: QID }).catch((e) => ({ error: e.message }));
  console.log("wikipedia harvest:", JSON.stringify(hw).slice(0, 160));

  const bio = await getIntroExtract({ name: "Ghostbusters", qid: QID, maxChars: 900 }).catch(() => null);
  const subject = {
    name: "Ghostbusters", kind: "work", domain: "film", wikidata_qid: QID,
    creator: "Ivan Reitman", yearsActive: "1984",
    description: "1984 American supernatural comedy film directed by Ivan Reitman, written by Dan Aykroyd and Harold Ramis",
    bio: bio ? { text: bio.text } : null,
  };
  const mix = await generateMix(subject, [], { model: "claude-opus-5", maxTokens: 28_000 });
  console.log("\nintro:", (mix.intro || "").slice(0, 200));
  const article = await loadSubjectArticle(subject);
  const slots = [];
  let n = 0, verified = 0, documented = 0;
  for (const slot of mix.slots) {
    const cands = [];
    for (const item of slot.candidates) {
      const [attribution, connection] = [
        await verifyAttribution(item).catch(() => null),
        await verifyConnection(item, subject, article, []).catch(() => null),
      ];
      cands.push({ item, verification: { attribution, connection, citations: [] } });
      n += 1;
      if (attribution?.status === "verified") verified += 1;
      if (connection?.status?.startsWith("documented")) documented += 1;
      console.log(`  [${item.slotType}] ${item.title} — ${item.creator} (${item.year || "?"}) | attr:${attribution?.status || "-"} conn:${connection?.status || "-"}`);
    }
    slots.push({ slotType: slot.slotType, candidates: cands });
  }
  await persistMixRun({ subject, rawQuery: "Ghostbusters", intro: mix.intro, slots, modelVersion: "claude-opus-5" });
  console.log(`\nGhostbusters: ${n} cards | verified ${verified} | documented ${documented} | spend so far $${usageSummary().totalUsd.toFixed(2)}`);
}

const subjects = await listSubjects();
for (const name of ["David Bowie", "Dave Chappelle", "Ghostbusters"]) {
  const s = subjects.find((x) => x.name === name);
  if (!s) { console.log(`✗ ${name}: no subject`); continue; }
  const t0 = Date.now();
  const r = await enrichStoredMixMedia(s, { deadline: Date.now() + 12 * 60_000 }).catch((e) => ({ error: e.message }));
  console.log(`media ${name}: ${JSON.stringify(r).slice(0, 200)} (${Math.round((Date.now() - t0) / 1000)}s)`);
}
console.log(`\ntotal model spend $${usageSummary().totalUsd.toFixed(2)}`);
await getPool().end();
