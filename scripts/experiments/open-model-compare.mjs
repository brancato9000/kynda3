#!/usr/bin/env node
// Open-model cost experiment (2026-09-16, Tony-approved, <$10): can
// Kimi K3 / GLM 5.2 replace Sonnet 5 on Kynda's recall-only workloads?
// The verifier stays dumb (V3-03), so every model faces the SAME
// deterministic gates; nothing is persisted (dryRun) — no graph pollution.
//
//   node scripts/experiments/open-model-compare.mjs --harvest            3 golden Wikipedia pages × models
//   node scripts/experiments/open-model-compare.mjs --research "Radiohead"   one subject × models (tool loops)
//   [--models claude-sonnet-5,moonshotai/kimi-k3,z-ai/glm-5.2]
//   [--subjects "Radiohead,The Godfather,Kendrick Lamar"]
//
// Appends a results section to reports/open-model-compare-<date>.md and
// records spend in spend.jsonl (script "experiment").

import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
try {
  for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* env */ }

const { usageSummary } = await import("../../src/lib/ai/anthropic.js");
const { openRouterConfigured } = await import("../../src/lib/ai/openrouter.js");
const { harvestText } = await import("../../src/lib/pipeline/harvest.js");
const { findArticleTitle, getIntroExtract } = await import("../../src/lib/entities/wikipedia.js");
const { fetchPageText, verifyEvidence } = await import("../../src/lib/verify/evidence.js");
const { researchSubject } = await import("../../src/lib/ai/researcher.js");
const { researchSubjectOpen } = await import("../../src/lib/ai/researcher-open.js");
const { slugify } = await import("../../src/lib/slug.js");
const { recordSpend } = await import("../../src/lib/spend.js");
const { dbConfigured, q, getPool } = await import("../../src/lib/db.js");
const { getClaimTargets } = await import("../../src/lib/store.js");

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const DEFAULT_MODELS = ["claude-sonnet-5", "moonshotai/kimi-k3", "z-ai/glm-5.2"];
const models = (flag("--models") || DEFAULT_MODELS.join(",")).split(",").map((s) => s.trim()).filter(Boolean);
const subjects = (flag("--subjects") || "Radiohead,The Godfather,Kendrick Lamar").split(",").map((s) => s.trim());
const today = new Date().toISOString().slice(0, 10);
const REPORT = path.join(ROOT, "reports", `open-model-compare-${today}.md`);

const usd = (n) => `$${n.toFixed(3)}`;
const secs = (ms) => `${(ms / 1000).toFixed(0)}s`;
function costSince(mark) {
  // usageSummary is cumulative across the process; diff against a mark.
  return usageSummary().totalUsd - mark;
}
function report(lines) {
  const fresh = !existsSync(REPORT);
  appendFileSync(REPORT, (fresh ? `# Open-model comparison — ${today}\n\nApproved by Tony 2026-09-16 (budget <$10). Same prompts, same schemas, same deterministic gates for every model; dry run, nothing persisted. Open models via OpenRouter (\`usage.cost\` receipts); Claude via Anthropic (sticker-price math).\n\n` : "") + lines.join("\n") + "\n\n");
}
function skipOpen(model) {
  if (model.includes("/") && !openRouterConfigured()) {
    console.log(`  ⊘ ${model}: OPENROUTER_API_KEY not set — skipped`);
    return true;
  }
  return false;
}
async function goldenFor(name) {
  try { return JSON.parse(readFileSync(path.join(ROOT, "eval", "golden", `${slugify(name)}.json`), "utf8")); } catch { return null; }
}

// ─── Harvest: one page fetched once, every model extracts from the same text ───
async function runHarvest() {
  const out = [`## Harvest — ${new Date().toISOString()}`, "", `Models: ${models.join(", ")}`, ""];
  const totals = {};
  const allRows = {};
  const ROWS = path.join(ROOT, "reports", `open-model-compare-rows-${today}.json`);
  try { Object.assign(allRows, JSON.parse(readFileSync(ROWS, "utf8"))); } catch { /* fresh */ }
  for (const name of subjects) {
    const golden = await goldenFor(name);
    // QID-first (V3-80): golden file, else the graph's own entity row.
    let qid = golden?.canonical?.wikidata_qid || null;
    if (!qid && dbConfigured()) {
      const er = await q("SELECT wikidata_qid FROM entities WHERE lower(name) = lower($1) AND wikidata_qid IS NOT NULL LIMIT 1", [name]);
      qid = er.rows[0]?.wikidata_qid || null;
    }
    const title = await findArticleTitle({ name, qid });
    if (!title) { console.log(`✗ ${name}: no Wikipedia article`); continue; }
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
    const page = await fetchPageText(url);
    if (!page.ok) { console.log(`✗ ${name}: fetch failed`); continue; }
    console.log(`\n═══ ${name} — ${url} (${page.text.length} chars) ═══`);
    out.push(`### ${name}`, "", `Source: ${url} (${page.text.length} chars of text)`, "", "| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |", "|---|---|---|---|---|---|---|---|---|");
    // Sonnet's confirmed pairs persist to a sidecar so later open-model
    // runs can measure recall overlap without re-buying the baseline.
    const BASELINE = path.join(ROOT, "reports", "open-model-compare-baseline.json");
    let baseline = {};
    try { baseline = JSON.parse(readFileSync(BASELINE, "utf8")); } catch { /* none yet */ }
    const confirmedSets = {};
    if (baseline[name]) confirmedSets["claude-sonnet-5"] = new Set(baseline[name]);
    for (const model of models) {
      if (skipOpen(model)) continue;
      const mark = usageSummary().totalUsd;
      const t0 = Date.now();
      let s;
      try {
        s = await harvestText({ url, text: page.text, model, dryRun: true, log: () => {} });
      } catch (err) {
        console.log(`  ✗ ${model}: ${err.message}`);
        out.push(`| ${model} | error: ${err.message.slice(0, 80)} | | | | | | | |`);
        continue;
      }
      const cost = costSince(mark);
      const ms = Date.now() - t0;
      const judged = s.confirmed + s.rejected;
      const pass = judged ? `${Math.round((100 * s.confirmed) / judged)}%` : "–";
      confirmedSets[model] = new Set(s.rows.filter((r) => r.ok).map((r) => `${r.subject}→${r.target}`.toLowerCase()));
      (allRows[name] ||= {})[model] = s.rows;
      writeFileSync(ROWS, JSON.stringify(allRows, null, 2));
      // Golden traps (the eval harness's own standard): a confirmed claim
      // that names one of the subject's own works as its influence, or an
      // attribution trap (title credited to the wrong creator).
      if (golden) {
        const lower = (x) => String(x || "").trim().toLowerCase();
        const selfTraps = new Set((golden.self_reference_traps || []).map(lower));
        const attrTraps = (golden.attribution_traps || []).map((t) => ({ title: lower(t.title), wrong: lower(t.creator) }));
        const confirmedRows = s.rows.filter((r) => r.ok);
        const selfRef = confirmedRows.filter((r) => lower(r.subject) === lower(golden.subject) && selfTraps.has(lower(r.target)));
        const attr = confirmedRows.filter((r) => attrTraps.some((t) => t.title === lower(r.target) && t.wrong === lower(r.targetCreator)));
        const v = selfRef.length + attr.length;
        const line = `      golden: ${v ? `${v} violation(s) — ${[...selfRef.map((r) => `self-ref ${r.target}`), ...attr.map((r) => `attribution ${r.target}/${r.targetCreator}`)].join(", ")}` : "PASS — 0 violations"}`;
        console.log(line);
        out.push(`  - ${model} golden: ${v ? `${v} violation(s): ${[...selfRef.map((r) => `self-ref ${r.target}`), ...attr.map((r) => `attribution ${r.target}/${r.targetCreator}`)].join(", ")}` : "PASS, 0 violations"}`);
      }
      if (model === "claude-sonnet-5") {
        baseline[name] = [...confirmedSets[model]];
        writeFileSync(BASELINE, JSON.stringify(baseline, null, 2));
      }
      console.log(`  ${model.padEnd(24)} extracted ${s.extracted}, ✓ ${s.confirmed} / ✗ ${s.rejected} / ⊘ ${s.dropped}  gate ${pass}  ${usd(cost)}  ${s.confirmed ? usd(cost / s.confirmed) + "/cit" : ""}  ${secs(ms)}`);
      out.push(`| ${model} | ${s.extracted} | ${s.confirmed} | ${s.rejected} | ${s.dropped} | ${pass} | ${usd(cost)} | ${s.confirmed ? usd(cost / s.confirmed) : "–"} | ${secs(ms)} |`);
      totals[model] = totals[model] || { confirmed: 0, rejected: 0, dropped: 0, cost: 0, ms: 0, pages: 0 };
      totals[model].confirmed += s.confirmed; totals[model].rejected += s.rejected; totals[model].dropped += s.dropped; totals[model].cost += cost; totals[model].ms += ms; totals[model].pages += 1;
      // Show the rejects: paraphrase vs invention is the quality signal.
      for (const r of s.rows.filter((r) => !r.ok).slice(0, 5)) console.log(`      ✗ ${r.subject} → ${r.target} (${r.reason})`);
    }
    // Overlap vs the Sonnet baseline: how much of Sonnet's recall does each open model reproduce, and what does it add?
    const base = confirmedSets["claude-sonnet-5"];
    if (base) {
      out.push("", `Recall overlap vs Sonnet 5 (${base.size} confirmed pairs):`);
      for (const [model, set] of Object.entries(confirmedSets)) {
        if (model === "claude-sonnet-5") continue;
        const shared = [...set].filter((k) => base.has(k)).length;
        const line = `- ${model}: reproduces ${shared}/${base.size} of Sonnet's confirmed pairs, adds ${set.size - shared} Sonnet didn't find`;
        console.log(`  ${line}`); out.push(line);
      }
    }
    out.push("");
  }
  out.push("### Harvest totals", "", "| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |", "|---|---|---|---|---|---|---|---|");
  for (const [model, t] of Object.entries(totals)) {
    const line = `| ${model} | ${t.pages} | ${t.confirmed} | ${t.rejected} | ${t.dropped} | ${usd(t.cost)} | ${t.confirmed ? usd(t.cost / t.confirmed) : "–"} | ${secs(t.ms / t.pages)} |`;
    out.push(line);
  }
  console.log("\n" + out.slice(-Object.keys(totals).length - 2).join("\n"));
  report(out);
}

// ─── Research: same subject + targets, each model hunts sources, one evidence gate ───
async function runResearch(name) {
  const out = [`## Research — ${name} — ${new Date().toISOString()}`, "", `Models: ${models.join(", ")}`, ""];
  const golden = await goldenFor(name);
  let subject = { name, domain: golden?.domain };
  let targets = [];
  if (dbConfigured()) {
    const er = await q("SELECT id, name, domain, wikidata_qid FROM entities WHERE lower(name) = lower($1) ORDER BY (mbid IS NOT NULL OR wikidata_qid IS NOT NULL) DESC LIMIT 1", [name]);
    if (er.rows[0]) { subject = { ...subject, ...er.rows[0] }; targets = await getClaimTargets(er.rows[0].id, 6); }
  }
  if (!targets.length && golden) targets = (golden.influence_facts || []).map((f) => ({ title: f.object, creator: "", claimType: f.type }));
  const bio = await getIntroExtract({ name, qid: subject.wikidata_qid || golden?.canonical?.wikidata_qid || null }).catch(() => null);
  const RROWS = path.join(ROOT, "reports", `open-model-compare-research-${today}.json`);
  let researchRows = {};
  try { researchRows = JSON.parse(readFileSync(RROWS, "utf8")); } catch { /* fresh */ }
  const subj = { name: subject.name, domain: subject.domain, bio: bio ? { text: bio.text } : null };
  console.log(`\n═══ research: ${name} — ${targets.length} targets: ${targets.map((t) => t.title).join("; ")} ═══`);
  out.push(`Targets (${targets.length}): ${targets.map((t) => t.title).join("; ")}`, "", "| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |", "|---|---|---|---|---|---|---|---|---|");

  for (const model of models) {
    if (skipOpen(model)) continue;
    // Retry-on-empty once, for every model (the V3-20 rule for Sonnet applies to all).
    for (let attempt = 1; attempt <= 2; attempt++) {
      const mark = usageSummary().totalUsd;
      const t0 = Date.now();
      let findings = [], budget = null;
      try {
        const r = model.includes("/")
          ? await researchSubjectOpen(subj, targets, { model, log: console.log })
          : await researchSubject(subj, targets, { model });
        findings = r.findings || []; budget = r.budget || null;
      } catch (err) {
        console.log(`  ✗ ${model} attempt ${attempt}: ${err.message}`);
        out.push(`| ${model} | ${attempt} | error: ${err.message.slice(0, 60)} | | | | | ${usd(costSince(mark))} | ${secs(Date.now() - t0)} |`);
        break;
      }
      const tally = { quote_confirmed: 0, unverifiable: 0, dead_link: 0 };
      const saved = [];
      for (const f of findings) {
        if (!f.sourceUrl || !f.quote) continue;
        const v = await verifyEvidence({ url: f.sourceUrl, quote: f.quote });
        tally[v.status] = (tally[v.status] || 0) + 1;
        saved.push({ target: f.targetTitle, url: f.sourceUrl, speaker: f.speaker, degree: f.sourceDegree, status: v.status });
        console.log(`    ${v.status === "quote_confirmed" ? "✓ T2" : `✗ ${v.status}`}  ${f.targetTitle} — ${f.publication || f.sourceUrl}${f.speaker ? ` (${f.speaker}, ${f.sourceDegree})` : ""}`);
      }
      ((researchRows[name] ||= {})[model] = saved);
      writeFileSync(RROWS, JSON.stringify(researchRows, null, 2));
      const cost = costSince(mark);
      const ms = Date.now() - t0;
      const tools = budget ? `${budget.searches}/${budget.fetches} (${budget.turns} turns)` : "server-side";
      console.log(`  ${model} attempt ${attempt}: ${findings.length} findings → ${tally.quote_confirmed} T2, ${tally.unverifiable} unverifiable, ${tally.dead_link} dead  ${tools}  ${usd(cost)}  ${secs(ms)}`);
      out.push(`| ${model} | ${attempt} | ${findings.length} | ${tally.quote_confirmed} | ${tally.unverifiable} | ${tally.dead_link} | ${tools} | ${usd(cost)} | ${secs(ms)} |`);
      if (findings.length) break;
      console.log(`  ↻ empty run — retrying once`);
    }
  }
  report(out);
}

const startUsd = usageSummary().totalUsd;
try {
  if (args.includes("--harvest")) await runHarvest();
  const researchName = flag("--research");
  if (researchName) await runResearch(researchName);
  if (!args.includes("--harvest") && !researchName) console.log("usage: --harvest | --research \"Subject\" [--models a,b] [--subjects a,b,c]");
} finally {
  const spent = usageSummary().totalUsd - startUsd;
  const { byLabel } = usageSummary();
  console.log(`\n═══ COST ═══`);
  for (const [label, s] of Object.entries(byLabel)) console.log(`  ${label}: ${s.calls} call(s), ${(s.in / 1000).toFixed(1)}k in / ${(s.out / 1000).toFixed(1)}k out → ${usd(s.usd)}`);
  console.log(`  TOTAL: ${usd(spent)}  (report: ${path.relative(ROOT, REPORT)})`);
  recordSpend(ROOT, "experiment", spent, `open-model-compare ${args.includes("--harvest") ? "harvest" : ""}${flag("--research") ? ` research:${flag("--research")}` : ""} [${models.join(",")}]`);
  await getPool()?.end();
}
