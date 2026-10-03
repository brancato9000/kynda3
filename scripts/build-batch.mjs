#!/usr/bin/env node
// Corpus build on the V3-86/87 stack: disambiguate (Haiku) → maps via the
// Anthropic Message Batches API (Opus 5, half price) → the same deterministic
// verification and persistence as wave.mjs → Wikipedia reading (Sol) →
// interview hunting (Sol) only where interviews plausibly exist.
//
//   node scripts/build-batch.mjs subjects.tsv [--budget 210] [--no-research]
//   node scripts/build-batch.mjs subjects.tsv --resolve-only   (match names, review, stop)
//   node scripts/build-batch.mjs --resume build-state-<stamp>.json
//
// Lines in subjects.tsv: "Category\tName". Subjects with a stored map are
// skipped. State (subjects + batch id + per-subject progress) is written to
// build-state-<stamp>.json after every step, so a sleeping laptop or a
// crash resumes with --resume instead of re-buying the batch.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* env */ }
// Bound a single interview hunt's tail cost (Sol averages ~$0.18).
process.env.KYNDA_RESEARCH_MAX_USD ||= "0.6";

const { disambiguate } = await import("../src/lib/pipeline/disambiguate.js");
const { buildMixRequest, finishMix, generateMix, verifyAttribution, verifyConnection, loadSubjectArticle, loadSubjectMembers, MIX_MODEL } = await import("../src/lib/pipeline/mix.js");
const { persistMixRun, recordSearch, getStoredMix } = await import("../src/lib/store.js");
const { harvestSubjectWikipedia } = await import("../src/lib/pipeline/harvest.js");
const { researchOne, interviewsLikely, wikidataYears } = await import("../src/lib/pipeline/research.js");
const { usageSummary, submitBatch, collectBatch, READER, RESEARCHER } = await import("../src/lib/ai/anthropic.js");
const { recordSpend } = await import("../src/lib/spend.js");
const { q, getPool } = await import("../src/lib/db.js");

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const BUDGET = Number(flag("--budget")) || 210;
const RESEARCH = !args.includes("--no-research");
const resumePath = flag("--resume");
const statePath = resumePath || path.join(ROOT, `build-state-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
let baseUsd = 0; // spend recorded by earlier sessions of this build
const spent = () => baseUsd + usageSummary().totalUsd;
const save = (st) => { st.priorUsd = spent(); writeFileSync(statePath, JSON.stringify(st, null, 2)); };

let state;
if (resumePath) {
  state = JSON.parse(readFileSync(resumePath, "utf8"));
  baseUsd = state.priorUsd || 0;
  console.log(`resuming ${path.basename(resumePath)}: ${state.subjects.length} subjects, batch ${state.batchId || "not submitted"}, $${(state.priorUsd || 0).toFixed(2)} spent before`);
} else {
  const listPath = args.find((a) => !a.startsWith("--") && a !== flag("--budget"));
  if (!listPath) { console.error("usage: build-batch.mjs subjects.tsv [--budget N] [--no-research] | --resume state.json"); process.exit(1); }
  const roster = readFileSync(listPath, "utf8").trim().split("\n").map((l) => { const [category, name] = l.split("\t"); return { category, name }; }).filter((r) => r.name);
  state = { roster: path.basename(listPath), subjects: [], batchId: null, priorUsd: 0 };

  // ── 1. Disambiguate every name (Haiku ranks; databases decide) ──
  console.log(`\n═══ 1. Disambiguating ${roster.length} names ═══`);
  for (const [i, { category, name }] of roster.entries()) {
    try {
      const d = await disambiguate(name);
      if (!d.subject) { console.log(`  ✗ ${name}: no match`); state.subjects.push({ category, name, status: "no_match" }); continue; }
      await recordSearch(name, d.subject, d.confidence).catch(() => {});
      const existing = await getStoredMix(d.subject).catch(() => null);
      if (existing?.slots) { console.log(`  ⊘ ${name}: already mapped`); state.subjects.push({ category, name, status: "existing" }); continue; }
      const members = await loadSubjectMembers(d.subject).catch(() => []);
      state.subjects.push({ id: `s${String(i).padStart(4, "0")}`, category, name, subject: d.subject, members, confidence: d.confidence, status: "pending" });
      console.log(`  → ${name} = ${d.subject.name}${d.subject.description ? ` (${d.subject.description})` : ""} [${d.confidence}]`);
    } catch (err) {
      console.log(`  ✗ ${name}: ${err.message}`);
      state.subjects.push({ category, name, status: "failed", error: err.message });
    }
    save(state);
  }
}

const pending = state.subjects.filter((s) => s.status === "pending");

// Review gate: short or crowded names can resolve to the wrong thing
// ("Psycho" → a punk band, "Tetris" → the Game Boy edition). Resolve, stop,
// review the list, delete or fix bad rows in the state file, then --resume.
if (args.includes("--resolve-only")) {
  console.log(`\n═══ Resolved ${pending.length} subjects — review before spending ═══`);
  for (const s of pending) console.log(`  ${s.confidence === "certain" ? " " : "?"} ${s.name.padEnd(32)} → ${s.subject.name}${s.subject.description ? ` (${s.subject.description})` : ""} [${s.confidence}]`);
  console.log(`\n  "?" = not certain. To drop one, set its "status" to "skipped" in ${path.relative(ROOT, statePath)}. Then: node scripts/build-batch.mjs --resume ${path.relative(ROOT, statePath)}`);
  await getPool()?.end();
  process.exit(0);
}

// ── 2. Maps: one batch, half price ──
if (pending.length && !state.batchId) {
  console.log(`\n═══ 2. Submitting ${pending.length} maps to the batch API (${MIX_MODEL}) ═══`);
  state.batchId = await submitBatch(pending.map((s) => ({
    id: s.id, model: MIX_MODEL, effort: "low", maxTokens: 32_000, // billed on use; 16k truncated Hokusai
    ...buildMixRequest(s.subject, s.members),
  })));
  console.log(`  batch ${state.batchId} submitted`);
  save(state);
}
if (state.batchId && pending.length) {
  console.log(`\n═══ 2b. Waiting for batch ${state.batchId} (usually under an hour) ═══`);
  const results = await collectBatch(state.batchId, { label: `mix_batch_${MIX_MODEL}` });
  for (const s of pending) {
    const r = results.get(s.id);
    s.mix = r?.ok ? r.value : null;
    s.status = r?.ok ? "mapped" : "map_failed";
    if (!r?.ok) { s.error = r?.error || "missing from results"; console.log(`  ✗ ${s.name}: ${s.error}`); }
  }
  console.log(`  ${pending.filter((s) => s.mix).length} maps back, ${pending.filter((s) => !s.mix).length} failed`);
  save(state);
}

// Live fallback for anything the batch dropped (full price, but only the stragglers).
for (const s of state.subjects.filter((x) => x.status === "map_failed")) {
  if (spent() >= BUDGET) break;
  try {
    console.log(`  ↻ ${s.name}: generating live`);
    s.liveMix = await generateMix(s.subject, s.members);
    s.status = "mapped";
  } catch (err) { s.error = err.message; console.log(`  ✗ ${s.name}: ${err.message}`); }
  save(state);
}

// ── 3–5. Per subject: verify + persist, read Wikipedia, hunt interviews ──
console.log(`\n═══ 3. Verifying, saving, reading, hunting ═══`);
for (const s of state.subjects) {
  if (spent() >= BUDGET) { console.log(`\n■ BUDGET STOP at $${spent().toFixed(2)}`); break; }
  const t0 = Date.now();
  try {
    if (s.status === "mapped") {
      const mix = s.liveMix || finishMix(s.mix, s.subject, s.members);
      const article = await loadSubjectArticle(s.subject).catch(() => null);
      const slots = [];
      const c = { candidates: 0, verified: 0, documented: 0 };
      for (const slot of mix.slots) {
        const cands = [];
        for (const item of slot.candidates) {
          const [attribution, connection] = await Promise.all([
            verifyAttribution(item).catch(() => null),
            verifyConnection(item, s.subject, article, s.members).catch(() => null),
          ]);
          cands.push({ item, verification: { attribution, connection, citations: [] } });
          c.candidates += 1;
          if (attribution?.status === "verified") c.verified += 1;
          if (connection?.status?.startsWith("documented")) c.documented += 1;
        }
        slots.push({ slotType: slot.slotType, candidates: cands });
      }
      await persistMixRun({ subject: s.subject, rawQuery: s.name, intro: mix.intro, slots });
      Object.assign(s, { status: "saved", cards: c.candidates, verified: c.verified, documented: c.documented });
      delete s.mix; delete s.liveMix;
      save(state);
      console.log(`\n▸ ${s.name}: map saved — ${c.candidates} cards, ✓${c.verified} ◆${c.documented}`);
    }
    if (s.status === "saved") {
      const h = await harvestSubjectWikipedia(s.subject, { model: READER() });
      s.wikipedia = h.skipped ? `skipped: ${h.skipped}` : h.error ? `error: ${h.error}` : `${h.confirmed} confirmed / ${h.rejected} rejected`;
      s.status = "read";
      save(state);
      console.log(`  Wikipedia (${READER()}): ${s.wikipedia}`);
    }
    if (s.status === "read") {
      if (!RESEARCH) { s.status = "done"; s.interviews = "not run (--no-research)"; save(state); continue; }
      const er = await q(
        "SELECT * FROM entities WHERE (wikidata_qid IS NOT NULL AND wikidata_qid = $1) OR lower(name) = lower($2) ORDER BY (wikidata_qid = $1) DESC NULLS LAST LIMIT 1",
        [s.subject.wikidata_qid || null, s.subject.name]
      );
      const entity = er.rows[0];
      const years = entity ? await wikidataYears(entity.wikidata_qid) : {};
      const gate = entity ? interviewsLikely(entity, years) : { hunt: false, why: "entity not found" };
      if (!gate.hunt) {
        s.interviews = `skipped (${gate.why})`;
      } else {
        const r = await researchOne(entity, { model: RESEARCHER(), log: () => {} });
        s.interviews = `${r.confirmed} confirmed / ${r.rejected} rejected`;
      }
      s.status = "done";
      save(state);
      console.log(`  interviews: ${s.interviews} | ${Math.round((Date.now() - t0) / 1000)}s | running $${spent().toFixed(2)}`);
    }
  } catch (err) {
    console.log(`  ✗ ${s.name} at ${s.status}: ${err.message}`);
    s.error = err.message;
    save(state);
  }
}

// ── Summary ──
const by = (st) => state.subjects.filter((s) => s.status === st).length;
const run = usageSummary();
console.log(`\n═══ BUILD SUMMARY ═══`);
console.log(`  done ${by("done")} | stopped mid-way ${state.subjects.filter((s) => ["mapped", "saved", "read"].includes(s.status)).length} | map failed ${by("map_failed")} | already mapped ${by("existing")} | no match ${by("no_match")} | failed ${by("failed")}`);
for (const [label, s] of Object.entries(run.byLabel)) console.log(`  ${label}: ${s.calls} call(s) → $${s.usd.toFixed(3)}`);
console.log(`  this session $${run.totalUsd.toFixed(2)} | whole build $${spent().toFixed(2)} | state: ${path.relative(ROOT, statePath)}`);
save(state);
recordSpend(ROOT, "build", run.totalUsd, `build-batch ${state.roster}: ${by("done")} done`);
await getPool()?.end();
