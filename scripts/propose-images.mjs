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
async function findArticleImage(title, creator) {
  const s = await enwiki({ action: "query", list: "search", srsearch: `${title} ${creator}`, srlimit: "3" });
  for (const hit of s.query?.search || []) {
    const d = await enwiki({
      action: "query", titles: hit.title, prop: "pageimages|extracts",
      exintro: "1", explaintext: "1", piprop: "name|original", pithumbsize: "640", pilicense: "any",
    });
    const page = Object.values(d.query?.pages || {})[0];
    if (!page || !page.pageimage) continue;
    const titleMatch = nrm(stripParen(page.title)) === nrm(title) || nrm(page.title) === nrm(title);
    const creatorMatch = nrm(page.extract || "").includes(nrm(creator));
    if (titleMatch && creatorMatch) return { article: page.title, file: page.pageimage, extract: page.extract || "" };
    await pause(150);
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

let applied = 0, classApplied = 0, proposed = 0, misses = 0, cards = 0;
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
      try { found = await findArticleImage(item.title, item.creator); } catch { found = null; }
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
      } else if (
        item.medium === "music" || /is (a|the) [^.]{0,90}?\b(album|EP|single|mixtape)\b/i.test(found.extract || "")
        || /is (a|the) [^.]{0,90}?\bfilm\b/i.test(found.extract || "")
      ) {
        // Class rules: covers (V3-73) and film posters (V3-74) — the two
        // settled fair-use categories, decided once by Tony. Posters are
        // marketing collateral; the rights-holder incentive runs TOWARD
        // display (Tony, ex-GM of IMDb).
        const isFilm = !(item.medium === "music" || /is (a|the) [^.]{0,90}?\b(album|EP|single|mixtape)\b/i.test(found.extract || ""));
        classApplied += 1;
        console.log(`  ${isFilm ? "🎬 poster (V3-74)" : "♪ cover (V3-73)"}: ${s.name} → ${item.title}`);
        if (!DRY) {
          Object.assign(item, {
            imageUrl: info.url, imagePage: info.page,
            imageLicense: isFilm ? "fair use — film poster thumbnail (class rule V3-74)" : "fair use — cover art thumbnail (class rule V3-73)",
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
