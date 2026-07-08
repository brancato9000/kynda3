// Kynda v3 eval harness.
//
// Stages:
//   1. Golden-set validation (offline) — every golden file is well-formed
//   2. Quote verifier self-test (offline) — normalize-and-match fixtures
//   3. Scoring self-test (offline) — metric definitions locked via fixtures
//   4. Live verification — canonical IDs resolve, true attributions pass,
//      trap attributions fail, decoys are surfaced (skipped with --offline)
//
// Exit code 0 = all checks pass. Run in CI on every change.

import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { quoteMatch } from "../src/lib/verify/quoteMatch.js";
import { findMention } from "../src/lib/entities/wikipedia.js";
import { htmlToText } from "../src/lib/verify/evidence.js";
import { rateLimit } from "../src/lib/guard.js";
import { scoreMixResult } from "./scoring.js";
import { searchArtist, verifyReleaseGroup, getArtistMembers, norm } from "../src/lib/entities/musicbrainz.js";
import { searchEntity } from "../src/lib/entities/wikidata.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OFFLINE = process.argv.includes("--offline");

let passCount = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    passCount++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push({ name, detail });
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function loadGolden() {
  const dir = path.join(HERE, "golden");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  const subjects = [];
  for (const f of files) {
    subjects.push({ file: f, ...JSON.parse(await readFile(path.join(dir, f), "utf8")) });
  }
  return subjects;
}

async function loadFixture(name) {
  return JSON.parse(await readFile(path.join(HERE, "fixtures", name), "utf8"));
}

// ── Stage 1: golden-set validation ─────────────────────────────────────────
function validateGolden(subjects) {
  console.log("\nStage 1 — golden-set validation");
  for (const g of subjects) {
    const problems = [];
    if (!g.subject) problems.push("missing subject");
    if (!["music", "film", "television", "literature", "art", "design", "architecture", "theater", "other"].includes(g.domain)) problems.push(`bad domain: ${g.domain}`);
    if (!g.canonical || (g.canonical.mbid == null && g.canonical.wikidata_qid == null)) problems.push("no canonical ID — golden subjects must be resolvable");
    for (const key of ["attribution_true", "attribution_traps", "self_reference_traps", "influence_facts", "decoys"]) {
      if (!Array.isArray(g[key])) problems.push(`${key} must be an array`);
    }
    for (const t of g.attribution_true || []) {
      if (!t.title || !t.creator) problems.push(`attribution_true entry missing title/creator`);
    }
    for (const t of g.attribution_traps || []) {
      if (!t.title || !t.creator || !t.actual_creator || !t.origin) problems.push(`attribution_traps entry missing title/creator/actual_creator/origin`);
    }
    for (const f of g.influence_facts || []) {
      if (typeof f.human_confirmed !== "boolean") problems.push(`influence_facts entry missing human_confirmed boolean (honesty rule V3-06)`);
    }
    check(`golden/${g.file} well-formed`, problems.length === 0, problems.join("; "));
  }
}

// ── Stage 2: quote verifier self-test ───────────────────────────────────────
function testQuoteMatch() {
  console.log("\nStage 2 — quote verifier self-test");
  const page = `In a 1994 Rolling Stone interview, Kurt Cobain said: “I was trying to
    write the ultimate pop song. I was basically trying to rip off the Pixies —
    I have to admit it.” The quote has been widely reprinted since.`;

  check(
    "matches despite curly quotes, line breaks, case",
    quoteMatch(page, 'i was basically trying to RIP OFF the Pixies - I have to admit it').matched
  );
  check(
    "rejects a quote that is not on the page",
    !quoteMatch(page, "we were always more influenced by the Beatles than anyone else").matched
  );
  check(
    "rejects too-short quotes (prove nothing)",
    quoteMatch(page, "the Pixies").reason === "quote_too_short"
  );

  // findMention — the connection-documentation primitive (V3-13)
  const article = `Radiohead are an English rock band formed in Abingdon in 1985.
    Their sound was shaped by the Pixies and by Can I say more unusual sources.
    The band can play very loud. Critics compared them to The Smiths early on.`;
  check(
    "findMention extracts the sentence containing the creator",
    findMention(article, "Pixies")?.sentence.includes("shaped by the Pixies") === true
  );
  check(
    "findMention handles a leading 'The' variant",
    findMention(article, "The Smiths")?.sentence.includes("Smiths") === true
  );
  check(
    "findMention is case-sensitive (lowercase 'can' prose does not match the band Can... except when capitalized)",
    findMention("the band can play loud.", "Can") === null
  );
  check(
    "findMention rejects names absent from the text",
    findMention(article, "Aphex Twin") === null
  );

  // htmlToText + quoteMatch — the T2 evidence gate operates on stripped HTML
  const html = `<html><head><style>.x{color:red}</style><script>var a=1;</script></head>
    <body><article><p>Cobain said: &ldquo;I was trying to rip off the <b>Pixies</b> &mdash; I have to admit it.&rdquo;</p></article></body></html>`;
  const stripped = htmlToText(html);
  check("htmlToText strips tags/scripts and decodes entities",
    stripped.includes('"I was trying to rip off the Pixies - I have to admit it."') && !stripped.includes("var a=1"));
  check("quote survives the strip→match pipeline",
    quoteMatch(stripped, "I was trying to rip off the Pixies — I have to admit it").matched);

  // rateLimit — the per-IP abuse guard (V3-22)
  const opts = { limit: 2, windowMs: 60_000 };
  check("rateLimit allows up to the limit then blocks",
    rateLimit("test:ip", opts) && rateLimit("test:ip", opts) && !rateLimit("test:ip", opts));
  check("rateLimit keys are independent", rateLimit("test:other", opts));
}

// ── Stage 3: scoring self-test ──────────────────────────────────────────────
async function testScoring(subjects) {
  console.log("\nStage 3 — scoring self-test");
  const golden = subjects.find((g) => g.subject === "Radiohead");
  const clean = scoreMixResult(await loadFixture("mix-radiohead-clean.json"), golden);
  check("clean fixture scores 0 violations", clean.pass, JSON.stringify(clean.violations));

  const bad = scoreMixResult(await loadFixture("mix-radiohead-bad.json"), golden);
  const types = bad.violations.map((v) => v.type).sort();
  const expected = [
    "essential_not_subject",
    "self_reference",
    "self_reference",
    "self_reference_title",
    "trap_attribution",
    "unearned_verified_badge",
  ].sort();
  check(
    "bad fixture flags exactly the 6 expected violations",
    JSON.stringify(types) === JSON.stringify(expected),
    `got: ${types.join(", ")}`
  );
}

// ── Stage 4: live verification ──────────────────────────────────────────────
async function testLive(subjects) {
  console.log("\nStage 4 — live verification (MusicBrainz / Wikidata)");
  for (const g of subjects) {
    if (g.canonical.mbid) {
      const results = await searchArtist(g.subject, 8);
      check(
        `${g.subject}: top MusicBrainz match is the canonical entity`,
        results[0]?.mbid === g.canonical.mbid,
        `top: ${results[0]?.name} (${results[0]?.mbid})`
      );
      for (const decoy of g.decoys || []) {
        if (!decoy.mbid) continue;
        check(
          `${g.subject}: decoy "${decoy.name}" surfaced in candidates`,
          results.some((r) => r.mbid === decoy.mbid),
          "decoy missing — disambiguation eval would be untestable"
        );
      }
      for (const t of g.attribution_true) {
        const v = await verifyReleaseGroup(t.title, t.creator);
        check(`${g.subject}: TRUE  "${t.title}" / ${t.creator} verifies`, v.verified, JSON.stringify(v.candidates || {}));
      }
      for (const t of g.attribution_traps) {
        const v = await verifyReleaseGroup(t.title, t.creator);
        check(
          `${g.subject}: TRAP  "${t.title}" / ${t.creator} rejected (actual: ${t.actual_creator})`,
          !v.verified,
          `WRONGLY VERIFIED: ${JSON.stringify(v)}`
        );
      }
      if (g.members_include?.length) {
        const members = await getArtistMembers(g.canonical.mbid);
        // norm() comparison, same as the runtime's hop-1 member matching —
        // MusicBrainz uses curly apostrophes (Ed O’Brien).
        const names = members.map((m) => norm(m.name));
        check(
          `${g.subject}: membership relations include ${g.members_include.join(", ")}`,
          g.members_include.every((n) => names.includes(norm(n))),
          `got: ${members.map((m) => m.name).join(", ")}`
        );
      }
    } else if (g.canonical.wikidata_qid) {
      const results = await searchEntity(g.subject, 8);
      check(
        `${g.subject}: canonical QID ${g.canonical.wikidata_qid} in Wikidata candidates`,
        results.some((r) => r.qid === g.canonical.wikidata_qid),
        `got: ${results.map((r) => r.qid).join(", ")}`
      );
      for (const decoy of g.decoys || []) {
        if (!decoy.wikidata_qid) continue;
        check(
          `${g.subject}: decoy "${decoy.name}" surfaced in candidates`,
          results.some((r) => r.qid === decoy.wikidata_qid)
        );
      }
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
const subjects = await loadGolden();
console.log(`Kynda v3 eval — ${subjects.length} golden subjects${OFFLINE ? " (offline mode)" : ""}`);

validateGolden(subjects);
testQuoteMatch();
await testScoring(subjects);
if (!OFFLINE) await testLive(subjects);

console.log(`\n${passCount} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ""}`);
  process.exit(1);
}
