// Spec-driven demo-page builder (2026-09-20, for the Mark Golin set).
// Each subject in the spec is built the "fully loaded" way: QID-first
// entity (V3-80), Wikipedia harvest, Opus mix at the 3-card default with
// MusicBrainz members where an mbid is given, per-card verification,
// then the generation-time media pass (V3-77 / V3-83). Subjects that
// already hold a stored mix are NOT regenerated unless --force; media
// still runs. Add the slugs to DEMO_SLUGS separately.
//   node scripts/experiments/demo-build.mjs scripts/experiments/specs/<spec>.json [--only "Name"] [--force] [--media-only]
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of readFileSync(`${ROOT}/.env.local`, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { q, getPool } = await import(`${ROOT}/src/lib/db.js`);
const { upsertEntity, persistMixRun, listSubjects, getStoredMix } = await import(`${ROOT}/src/lib/store.js`);
const { harvestSubjectWikipedia } = await import(`${ROOT}/src/lib/pipeline/harvest.js`);
const { generateMix, loadSubjectMembers, loadSubjectArticle, verifyAttribution, verifyConnection } = await import(`${ROOT}/src/lib/pipeline/mix.js`);
const { enrichStoredMixMedia } = await import(`${ROOT}/src/lib/pipeline/media.js`);
const { getIntroExtract } = await import(`${ROOT}/src/lib/entities/wikipedia.js`);
const { usageSummary } = await import(`${ROOT}/src/lib/ai/anthropic.js`);

const args = process.argv.slice(2);
const specPath = args.find((a) => a.endsWith(".json"));
if (!specPath) { console.log("usage: demo-build.mjs <spec.json> [--only Name] [--force] [--media-only]"); process.exit(1); }
const spec = JSON.parse(readFileSync(path.resolve(specPath), "utf8"));
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx === -1 ? null : args[onlyIdx + 1];
const FORCE = args.includes("--force");
const MEDIA_ONLY = args.includes("--media-only");
const MODEL = "claude-opus-5";

for (const s of spec.subjects) {
  if (ONLY && s.name !== ONLY) continue;
  console.log(`\n═══════════ ${s.name} (${s.kind}/${s.domain}, ${s.wikidata_qid}${s.mbid ? ", mbid" : ""})`);

  // 1 — entity, ids in hand
  const id = await upsertEntity({ name: s.name, kind: s.kind, domain: s.domain, wikidata_qid: s.wikidata_qid, mbid: s.mbid || null, year: s.year || null, metadata: s.metadata || {} });
  await q(`UPDATE entities SET kind = $2, domain = $3, wikidata_qid = COALESCE(wikidata_qid, $4), mbid = COALESCE(mbid, $5), year_start = COALESCE(year_start, $6) WHERE id = $1`,
    [id, s.kind, s.domain, s.wikidata_qid, s.mbid || null, s.year || null]);
  console.log("entity:", id);

  const subject = { id, name: s.name, kind: s.kind, domain: s.domain, wikidata_qid: s.wikidata_qid, mbid: s.mbid || null, description: s.description || null, yearsActive: s.yearsActive || null };
  const existing = await getStoredMix(subject).catch(() => null);

  if (!MEDIA_ONLY && (!existing || FORCE)) {
    // 2 — Wikipedia harvest (QID sitelink → the right article, never a namesake)
    const hw = await harvestSubjectWikipedia({ name: s.name, kind: s.kind, domain: s.domain, wikidata_qid: s.wikidata_qid }).catch((e) => ({ error: e.message }));
    console.log("wikipedia harvest:", JSON.stringify(hw).slice(0, 160));

    // 3 — the mix
    const bio = await getIntroExtract({ name: s.name, qid: s.wikidata_qid, maxChars: 900 }).catch(() => null);
    subject.bio = bio ? { text: bio.text } : null;
    const members = s.mbid ? await loadSubjectMembers(subject).catch(() => []) : [];
    const mix = await generateMix(subject, members, { model: MODEL, maxTokens: 28_000 });
    console.log("\nintro:", (mix.intro || "").slice(0, 220));
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
    await persistMixRun({ subject, rawQuery: s.rawQuery || s.name, intro: mix.intro, slots, modelVersion: MODEL });
    console.log(`\n${s.name}: ${n} cards | verified ${verified} | documented ${documented} | spend so far $${usageSummary().totalUsd.toFixed(2)}`);
  } else if (existing) {
    console.log(`stored mix kept (${existing.slots?.reduce((a, sl) => a + (sl.candidates?.length || 0), 0)} cards) — pass --force to regenerate`);
  }

  // 4 — media, generation-time pass with a hard deadline
  const row = (await listSubjects()).find((x) => x.name === s.name);
  if (row) {
    const t0 = Date.now();
    const r = await enrichStoredMixMedia(row, { deadline: Date.now() + 12 * 60_000 }).catch((e) => ({ error: e.message }));
    console.log(`media: ${JSON.stringify(r).slice(0, 200)} (${Math.round((Date.now() - t0) / 1000)}s)`);
  }
}
console.log(`\ntotal model spend $${usageSummary().totalUsd.toFixed(2)}`);
await getPool().end();
