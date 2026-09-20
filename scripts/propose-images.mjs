#!/usr/bin/env node
// Auto-propose image harvester (Tony, 2026-08-10): English Wikipedia holds
// an infobox image for nearly every notable modern work — the two-thirds
// P18 can't reach. Three outcomes per imageless card, by license reality:
//   COMMONS + allowlist → applied immediately (same trust as the P18
//     backfill; licensed path, attribution, entity mirror);
//   NON-FREE cover art on a MUSIC card → applied under the V3-73 class
//     rule (thumbnail, card-scoped, V3-72 caveat renders);
//   NON-FREE anything else → PROPOSED into the curator queue as a
//     media_flag — Tony's per-asset judgment, one click in admin.
// Identity gates: the en-wiki article's title must match the work, and
// its intro must name the creator (official-page-gate spirit).
//
//   node scripts/propose-images.mjs [--subject "Name"] [--dry] [--limit N]

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

const UA = { "User-Agent": "Kynda/3.0 (kynda3.vercel.app; brancato@gmail.com)" };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const DRY = process.argv.includes("--dry");
const subjFlag = process.argv.indexOf("--subject");
const ONLY_SUBJECT = subjFlag === -1 ? null : process.argv[subjFlag + 1];
const limFlag = process.argv.indexOf("--limit");
const LIMIT = limFlag === -1 ? null : parseInt(process.argv[limFlag + 1], 10);
const ALLOWLIST = /^(public domain|pd|cc0|cc[ -]by(-sa)?([ -]\d(\.\d)?)?)/i;

const nrm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const stripParen = (s) => (s || "").replace(/\s*\(.*?\)\s*$/, "");

async function enwiki(params) {
  const u = new URL("https://en.wikipedia.org/w/api.php");
  for (const [k, v] of Object.entries({ format: "json", ...params })) u.searchParams.set(k, v);
  return (await fetch(u, { headers: UA })).json();
}

/** Find the work's en-wiki article + lead image, identity-gated. */
function fairUseClass(item, extract) {
  // The article decides what the thing IS (2026-09-22): the earliest kind
  // noun after "is a/an/the" wins, so "a 1979 film based on the 1977 novel"
  // is a film and "a 1977 novel, adapted into a 1979 film" is a novel. The
  // card's medium is only the fallback when the lead names no kind — the
  // accept() gate has already refused any article whose kind clashes.
  const e = (extract || "").slice(0, 400);
  const KINDS = [
    ["music", /is (a|an|the|[^.]{0,40}?'s) [^.]{0,90}?\b(album|EP|single(?!-)|mixtape)\b/i],
    ["television", /is (a|an|the|[^.]{0,40}?'s) [^.]{0,110}?\b(television series|TV series|television sitcom|television program|television show|streaming series|web series|miniseries|stand-up( comedy)? special|comedy special|television special|HBO special|Netflix special)\b/i],
    ["film", /is (a|an|the) [^.]{0,90}?\b(film|movie|(?:drama|comedy|thriller|documentary|feature|anime) (?:film )?(?:written and )?directed by)\b/i],
    ["literature", /is (a|an|the) [^.]{0,110}?\b(novel|novella|memoir|autobiography|poetry collection|collection of poems|short story collection|essay collection)\b/i],
  ];
  let best = null;
  for (const [kind, re] of KINDS) {
    const m = re.exec(e);
    if (m && (!best || m.index < best.index)) best = { kind, index: m.index };
  }
  const kind = best?.kind || (item.medium === "music" ? "music" : item.medium === "literature" ? "literature" : null);
  if (kind === "music") return { label: "♪ cover", license: "fair use — cover art thumbnail (class rule V3-73)" };
  if (kind === "television") return { label: "📺 title card", license: "fair use — TV title card thumbnail (class rule V3-75)" };
  if (kind === "literature") return { label: "📕 jacket", license: "fair use — book jacket thumbnail (class rule V3-76)" };
  if (kind === "film") return { label: "🎬 poster", license: "fair use — film poster thumbnail (class rule V3-74)" };
  return null;
}

async function findArticleImage(title, creator, medium = null) {
  // Identity gates (V3-77) with two additions (2026-09-14, Chappelle/
  // Ghostbusters demo autopsy): (1) look the exact title up DIRECTLY first
  // — an exact-title page, or Wikipedia's own redirect from it, is a
  // stronger identity signal than a search hit, and search let person
  // pages outrank "Saturday Night Live", "Gremlins", "Stranger Things";
  // (2) comedy specials live under "Comedian: Title", so the creator-
  // prefixed form is tried and accepted in both directions. The creator
  // gate (creator named in the article's lead, or in its title) still
  // holds on every path — a common-word title whose page is something
  // else fails it.
  const bare = title.replace(new RegExp(`^${creator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`, "i"), "");
  // Medium check (2026-09-22, Going All the Way autopsy): an adaptation's
  // article names the source author ("screenplay by Dan Wakefield, based
  // on his novel"), so the creatorship phrase alone let a 1997 film poster
  // land on a 1970 novel card. What the article says the thing IS must
  // agree with what the card says it is.
  const articleMedium = (ex) => {
    const e = (ex || "").slice(0, 400);
    if (/\bis (a|an|the) [^.]{0,110}?\b(television series|TV series|television sitcom|television program|television show|streaming series|web series|miniseries|stand-up( comedy)? special|comedy special|television special)\b/i.test(e)) return "television";
    if (/\bis (a|an|the) [^.]{0,90}?\b(film|movie|(?:drama|comedy|thriller|documentary|feature|anime) (?:film )?(?:written and )?directed by)\b/i.test(e)) return "film";
    if (/\bis (a|an|the|[^.]{0,40}?'s) [^.]{0,90}?\b(album|EP|single(?!-)|mixtape|song)\b/i.test(e)) return "music";
    if (/\bis (a|an|the) [^.]{0,110}?\b(novel|novella|memoir|autobiography|book|poetry collection|collection of poems|short story|essay collection|play)\b/i.test(e)) return "literature";
    return null;
  };
  const mediumClash = (page) => {
    if (!medium) return false;
    const am = articleMedium(page.extract);
    if (!am) return false;
    const want = medium === "comedy" ? "television" : medium;
    if (["literature", "film", "television", "music"].includes(want)) return am !== want && !(want === "television" && am === "film");
    return false;
  };
  const accept = (page, direct) => {
    if (!page?.pageimage) return null;
    if (mediumClash(page)) return null;
    const pt = nrm(stripParen(page.title));
    const titleMatch = direct || pt === nrm(stripParen(bare)) || nrm(page.title) === nrm(bare)
      || pt === nrm(`${creator}: ${bare}`) || pt === nrm(`${creator} ${bare}`);
    // Creator gate tightened (Chappelle autopsy, 2026-09-14): the creator
    // must be named in the article's OPENING two sentences — the "X is a
    // 1996 special by Chris Rock" sentence — or in its title. A passing
    // mention deeper in the lead ("the title was later used for Chris
    // Rock's special") put Method Man's cover on Chris Rock's card.
    const opening = (page.extract || "").split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
    // Creatorship phrase (2026-09-20, Zhang Yimou autopsy): film leads often
    // spend their first sentences on plot ("Red Sorghum is a 1988 Chinese
    // film about a young woman...") and CJK leads carry "lit." abbreviations
    // that break the sentence count — so a "by <creator>" / "starring
    // <creator>" phrase anywhere in the lead also satisfies the gate. A bare
    // mention ("Chris Rock named his special after this song") still fails.
    const flat = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const creWords = flat(creator).replace(/[^a-z0-9 ]/g, " ").trim().split(/\s+/).join("\\s+");
    const phrase = creWords && new RegExp(`\\b(by|starring|debut of|debut for)\\s+(?:[^.;()]{0,60}?\\s)?${creWords}\\b`).test(flat(page.extract).replace(/[^a-z0-9 .;()]/g, " "));
    const creatorMatch = nrm(opening).includes(nrm(creator)) || nrm(page.title).includes(nrm(creator)) || phrase;
    return titleMatch && creatorMatch ? { article: page.title, file: page.pageimage, extract: page.extract || "" } : null;
  };
  const pageFor = async (titles) => {
    const d = await enwiki({
      action: "query", titles, redirects: "1", prop: "pageimages|extracts",
      exintro: "1", explaintext: "1", piprop: "name|original", pithumbsize: "640", pilicense: "any",
    });
    const page = Object.values(d.query?.pages || {})[0];
    return page && page.missing === undefined ? page : null;
  };
  // Creator-prefixed article first: when "Chris Rock: Bring the Pain"
  // exists it is the more specific identity than bare "Bring the Pain".
  // If a "Creator: Title" article exists, the bare title is by definition
  // a DIFFERENT work (Method Man's "Bring the Pain" vs Chris Rock's) —
  // accept only the prefixed page, and never fall through to bare/search.
  const prefixed = await pageFor(`${creator}: ${bare}`);
  if (prefixed) return accept(prefixed, true);
  await pause(120);
  // Kind-qualified title first when the card knows its medium — "Going
  // All the Way (novel)" is the novel; bare "Going All the Way" is the film.
  const qualified = { literature: ["novel", "book"], film: ["film"], television: ["TV series"], music: ["album", "song"] }[medium] || [];
  for (const kind of qualified) {
    const hit = accept(await pageFor(`${bare} (${kind})`), true);
    if (hit) return hit;
    await pause(120);
  }
  {
    const hit = accept(await pageFor(bare), true);
    if (hit) return hit;
    await pause(120);
  }
  const s = await enwiki({ action: "query", list: "search", srsearch: `${bare} ${creator}`, srlimit: "3" });
  for (const h of s.query?.search || []) {
    const hit = accept(await pageFor(h.title), false);
    if (hit) return hit;
    await pause(120);
  }
  return null;
}

/** Where does the file live, and under what license? */
async function fileInfo(file) {
  // Commons first — licensed path if the license clears the allowlist.
  const c = await (await fetch(
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${file}`)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800&format=json`,
    { headers: UA }
  )).json();
  const cp = Object.values(c.query?.pages || {})[0];
  if (cp?.imageinfo?.[0]) {
    const ii = cp.imageinfo[0];
    const license = ii.extmetadata?.LicenseShortName?.value || "";
    if (ALLOWLIST.test(license)) {
      return {
        host: "commons", license,
        url: ii.thumburl || ii.url, page: ii.descriptionurl,
        credit: ((ii.extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, "").trim() || "Wikimedia Commons").slice(0, 120),
      };
    }
    return { host: "commons_nonfree", license };
  }
  // en-wiki local file = non-free. Thumbnail size per V3-73 spirit.
  const e = await enwiki({ action: "query", titles: `File:${file}`, prop: "imageinfo", iiprop: "url", iiurlwidth: "400" });
  const ep = Object.values(e.query?.pages || {})[0];
  const ii = ep?.imageinfo?.[0];
  if (!ii) return null;
  return { host: "enwiki_nonfree", url: ii.thumburl || ii.url, page: ii.descriptionurl };
}

// ── main ──
const subjects = (await q(
  `SELECT e.name, m.id AS mix_id, m.payload FROM mixes m JOIN entities e ON e.id = m.subject_entity_id
   ${ONLY_SUBJECT ? "WHERE lower(e.name) = lower($1)" : ""}
   ORDER BY m.created_at DESC`,
  ONLY_SUBJECT ? [ONLY_SUBJECT] : []
)).rows;
// latest mix per subject only
const seen = new Set();
const work = [];
for (const s of subjects) {
  if (seen.has(s.name.toLowerCase())) continue;
  seen.add(s.name.toLowerCase());
  work.push(s);
}

let applied = 0, classApplied = 0, proposed = 0, misses = 0, cards = 0, cls = null;
outer: for (const s of work) {
  let dirty = false;
  for (const slot of s.payload.slots || []) {
    for (const cand of slot.candidates || []) {
      const item = cand?.item;
      if (!item?.title || !item?.creator) continue;
      if (item.imageUrl !== undefined && item.imageUrl !== null) continue; // has image, or "" = suppressed
      // entity-backfilled image already covers it?
      const ent = await q(
        `SELECT 1 FROM entities WHERE metadata->>'image_url' IS NOT NULL
           AND regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = regexp_replace(lower($1), '[^a-z0-9]', '', 'g') LIMIT 1`,
        [item.title]
      );
      if (ent.rows[0]) continue;
      if (LIMIT && cards >= LIMIT) break outer;
      cards += 1;
      await pause(350);

      let found;
      try { found = await findArticleImage(item.title, item.creator, item.medium); } catch { found = null; }
      if (!found) { misses += 1; continue; }
      let info;
      try { info = await fileInfo(found.file); } catch { info = null; }
      if (!info || info.host === "commons_nonfree" || !info.url) { misses += 1; continue; }

      if (info.host === "commons") {
        applied += 1;
        console.log(`  ✓ licensed: ${s.name} → ${item.title} [${info.license}]`);
        if (!DRY) {
          Object.assign(item, { imageUrl: info.url, imagePage: info.page, imageLicense: info.license, imageCredit: info.credit });
          dirty = true;
          await q(
            `UPDATE entities SET metadata = metadata || $2::jsonb
             WHERE kind = 'work' AND regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = regexp_replace(lower($1), '[^a-z0-9]', '', 'g')`,
            [item.title, JSON.stringify({ image_url: info.url, image_page: info.page, image_license: info.license, image_credit: info.credit })]
          );
        }
      } else if ((cls = fairUseClass(item, found.extract))) {
        // Class rules (V3-73 covers, V3-74 posters, V3-75 title cards,
        // V3-76 jackets): settled fair-use categories, decided once by
        // Tony. The article's own kind noun picks the class (2026-09-22).
        classApplied += 1;
        console.log(`  ${cls.label}: ${s.name} → ${item.title}`);
        if (!DRY) {
          Object.assign(item, {
            imageUrl: info.url, imagePage: info.page,
            imageLicense: cls.license,
            imageCredit: `en.wikipedia (${found.article})`,
          });
          dirty = true;
        }
      } else {
        proposed += 1;
        console.log(`  ⚑ proposed: ${s.name} → ${item.title} (${found.article})`);
        if (!DRY) {
          await q(
            `INSERT INTO contributions (kind, subject_name, item_title, item_creator, slot_type, url, comment, contributor, status)
             SELECT 'media_flag', $1, $2, $3, $4, $5, $6, 'kynda-proposer', 'pending'
             WHERE NOT EXISTS (SELECT 1 FROM contributions WHERE kind = 'media_flag' AND subject_name = $1 AND item_title = $2 AND status = 'pending')`,
            [s.name, item.title, item.creator, item.slotType || null, info.url,
             `[image · suggested media for a card that has none] auto-proposed: en-wiki infobox image for "${found.article}" (non-free — approving publishes under the V3-72 fair-use posture)`]
          );
        }
      }
    }
  }
  if (dirty && !DRY) {
    await q("UPDATE mixes SET payload = $2 WHERE id = $1", [s.mix_id, JSON.stringify(s.payload)]);
  }
}

console.log(`\ncards examined: ${cards} | licensed applied: ${applied} | cover class-rule applied: ${classApplied} | proposed to queue: ${proposed} | no confident find: ${misses}${DRY ? " (dry)" : ""}`);
await getPool().end();
