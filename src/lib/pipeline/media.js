// Media-on-generation (V3-77, Tony 2026-08-16): a fresh mix used to arrive
// bare — art and previews existed only as batch scripts run by hand, so a
// public visitor's page looked nothing like the demo pages. This module is
// those scripts' logic as a serve-path citizen: it runs AFTER the response
// has streamed (riding the same post-response window as harvest-on-search),
// under a hard wall-clock deadline, and quits cleanly mid-list when time
// runs out — whatever it didn't reach still belongs to the batch scripts.
//
// Zero model calls. Wikipedia/Commons for art (licensed path first, then
// the settled fair-use class rules V3-73..V3-76), iTunes then Deezer for
// 30-second previews. Identity gates are the same ones the batch scripts
// use: article title must match the work, its intro must name the creator;
// preview artist must match the credited creator. A wrong image or wrong
// audio is worse than none.

import { q, dbConfigured } from "../db.js";

const UA = { "User-Agent": "Kynda/3.0 (kynda3.vercel.app; brancato@gmail.com)" };
const ALLOWLIST = /^(public domain|pd|cc0|cc[ -]by(-sa)?([ -]\d(\.\d)?)?)/i;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const nrm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const stripParen = (s) => (s || "").replace(/\s*[([].*?[)\]]\s*/g, " ").trim();

async function enwiki(params) {
  const u = new URL("https://en.wikipedia.org/w/api.php");
  for (const [k, v] of Object.entries({ format: "json", ...params })) u.searchParams.set(k, v);
  return (await fetch(u, { headers: UA })).json();
}

/** The work's en-wiki article + lead image, identity-gated (title matches
 * the work, intro names the creator) — propose-images.mjs semantics. */
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

async function fileInfo(file) {
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
        host: "commons", license, url: ii.thumburl || ii.url, page: ii.descriptionurl,
        credit: ((ii.extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, "").trim() || "Wikimedia Commons").slice(0, 120),
      };
    }
    return null; // non-free ON COMMONS: no path
  }
  const e = await enwiki({ action: "query", titles: `File:${file}`, prop: "imageinfo", iiprop: "url", iiurlwidth: "400" });
  const ii = Object.values(e.query?.pages || {})[0]?.imageinfo?.[0];
  return ii ? { host: "enwiki_nonfree", url: ii.thumburl || ii.url, page: ii.descriptionurl } : null;
}

/** Which settled fair-use class covers this card, if any (V3-73..76). */
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

// ── previews: iTunes (loose album/song match) then Deezer ──
const toks = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().match(/[a-z]+/g) || [];
function titleOk(ours, theirs, creator) {
  const a = nrm(stripParen(ours)), b = nrm(stripParen(theirs));
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  if (shorter.length >= 8 && (a.includes(b) || b.includes(a))) return true;
  const cred = new Set(toks(creator));
  const ta = toks(stripParen(ours)).filter((t) => !cred.has(t));
  const tb = toks(stripParen(theirs)).filter((t) => !cred.has(t));
  const [small, big] = ta.length <= tb.length ? [ta, new Set(tb)] : [tb, new Set(ta)];
  return small.length >= 3 && small.every((t) => big.has(t));
}
const creatorOk = (artist, creator) => {
  const a = nrm(artist), c = nrm(creator);
  return !!a && !!c && (a.includes(c) || c.includes(a));
};

async function findPreview(title, creator) {
  try {
    const alb = await (await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(`${creator} ${title}`)}&media=music&entity=album&limit=8`,
      { headers: UA })).json();
    for (const a of alb.results || []) {
      if (!titleOk(title, a.collectionName, creator)) continue;
      if (!creatorOk(a.artistName, creator) && !nrm(a.collectionName).includes(nrm(creator.split(/\s+/).pop()))) continue;
      await pause(1200);
      const d = await (await fetch(`https://itunes.apple.com/lookup?id=${a.collectionId}&entity=song&limit=40`, { headers: UA })).json();
      const t = (d.results || []).find((x) => x.wrapperType === "track" && x.previewUrl);
      if (t) return { url: t.previewUrl, page: t.trackViewUrl || a.collectionViewUrl, source: null };
    }
    await pause(1200);
    const s = await (await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(`${creator} ${title}`)}&media=music&entity=song&limit=8`,
      { headers: UA })).json();
    for (const t of s.results || []) {
      if (!t.previewUrl || !creatorOk(t.artistName, creator)) continue;
      if (titleOk(title, t.trackName, creator) || titleOk(title, t.collectionName, creator))
        return { url: t.previewUrl, page: t.trackViewUrl, source: null };
    }
  } catch { /* fall through to Deezer */ }
  try {
    await pause(400);
    const dz = await (await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(`artist:"${creator}" album:"${stripParen(title)}"`)}&limit=5`,
      { headers: UA })).json();
    const hit = (dz.data || []).find((t) => t.preview && creatorOk(t.artist?.name, creator) &&
      (titleOk(title, t.album?.title, creator) || titleOk(title, t.title, creator)));
    if (hit) return {
      url: hit.preview,
      page: hit.album?.id ? `https://www.deezer.com/album/${hit.album.id}` : hit.link,
      source: "Deezer",
    };
  } catch { /* silence beats a wrong preview */ }
  return null;
}

/** Does serve-time hydration already cover this card? Mirrors getCardMedia's
 * title+creator congruence so we never duplicate what would render anyway. */
async function entityMedia(item) {
  const r = await q(
    `SELECT metadata->>'image_url' AS img, metadata->>'preview_url' AS prev
     FROM entities
     WHERE (metadata->>'image_url' IS NOT NULL OR metadata->>'preview_url' IS NOT NULL)
       AND regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = regexp_replace(lower($1), '[^a-z0-9]', '', 'g')
       AND ($2 = '' OR regexp_replace(lower(COALESCE(metadata->>'creator', '')), '[^a-z0-9]', '', 'g') = regexp_replace(lower($2), '[^a-z0-9]', '', 'g'))
     LIMIT 1`,
    [item.title || "", (item.creator || "").trim()]
  );
  return r.rows[0] || null;
}

async function stampPreviewEntity(item, hit) {
  // Update the matching work entity, or create one WITH ITS CREATOR — the
  // creator-less entities of 2026-08-14 held media the identity gate then
  // refused to serve. Harvested-but-invisible is the expensive failure.
  const media = { preview_url: hit.url, preview_page: hit.page, ...(hit.source ? { preview_source: hit.source } : {}) };
  const rows = (await q(
    `SELECT id, metadata->>'creator' AS creator FROM entities
     WHERE regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = regexp_replace(lower($1), '[^a-z0-9]', '', 'g')`,
    [item.title])).rows;
  const ent = rows.length > 1 ? rows.find((e) => nrm(e.creator) === nrm(item.creator)) : rows[0];
  if (ent) {
    await q(`UPDATE entities SET metadata = metadata || $2::jsonb WHERE id = $1`,
      [ent.id, JSON.stringify({ ...(ent.creator ? {} : { creator: item.creator }), ...media })]);
  } else {
    await q(`INSERT INTO entities (kind, domain, name, metadata) VALUES ('work', 'music', $1, $2::jsonb)`,
      [item.title, JSON.stringify({ creator: item.creator, ...media })]);
  }
}

/**
 * Enrich the stored mix's cards with art + previews, under a deadline.
 * Returns { images, previews, examined, outOfTime }.
 */
export async function enrichStoredMixMedia(subject, { deadline = Date.now() + 150_000 } = {}) {
  if (!dbConfigured()) return { skipped: "no database" };
  const clauses = [];
  const params = [];
  if (subject.mbid) { params.push(subject.mbid); clauses.push(`e.mbid = $${params.length}`); }
  if (subject.wikidata_qid) { params.push(subject.wikidata_qid); clauses.push(`e.wikidata_qid = $${params.length}`); }
  params.push(subject.name); clauses.push(`lower(e.name) = lower($${params.length})`);
  const mr = (await q(
    `SELECT m.id, m.payload FROM mixes m JOIN entities e ON e.id = m.subject_entity_id
     WHERE (${clauses.join(" OR ")}) ORDER BY m.created_at DESC LIMIT 1`, params)).rows[0];
  if (!mr?.payload?.slots) return { skipped: "no mix" };

  const out = { images: 0, previews: 0, examined: 0, outOfTime: false };
  let dirty = false;
  const cards = [];
  for (const s of mr.payload.slots) for (const c of s.candidates || []) if (c.item?.title && c.item?.creator) cards.push(c.item);

  // Pass 1 — art (fast; en-wiki is generous).
  for (const item of cards) {
    if (Date.now() > deadline) { out.outOfTime = true; break; }
    if (item.imageUrl !== undefined && item.imageUrl !== null) continue;
    const have = await entityMedia(item);
    if (have?.img) continue;
    out.examined += 1;
    await pause(250);
    let found = null, info = null;
    try { found = await findArticleImage(item.title, item.creator, item.medium); } catch { /* skip */ }
    if (found) { try { info = await fileInfo(found.file); } catch { /* skip */ } }
    if (!found || !info?.url) continue;
    if (info.host === "commons") {
      Object.assign(item, { imageUrl: info.url, imagePage: info.page, imageLicense: info.license, imageCredit: info.credit });
      dirty = true; out.images += 1;
      await q(
        `UPDATE entities SET metadata = metadata || $2::jsonb
         WHERE kind = 'work' AND regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = regexp_replace(lower($1), '[^a-z0-9]', '', 'g')`,
        [item.title, JSON.stringify({ image_url: info.url, image_page: info.page, image_license: info.license, image_credit: info.credit })]
      ).catch(() => {});
    } else {
      const cls = fairUseClass(item, found.extract);
      if (!cls) continue; // no class rule → per-asset judgment stays with the batch/curator path
      Object.assign(item, { imageUrl: info.url, imagePage: info.page, imageLicense: cls.license, imageCredit: `en.wikipedia (${found.article})` });
      dirty = true; out.images += 1;
    }
  }

  // Pass 2 — previews (slower; iTunes pacing).
  for (const item of cards) {
    if (Date.now() > deadline) { out.outOfTime = true; break; }
    if (item.medium !== "music" || item.previewUrl) continue;
    const have = await entityMedia(item);
    if (have?.prev) continue;
    await pause(1200);
    const hit = await findPreview(item.title, item.creator);
    if (!hit) continue;
    await stampPreviewEntity(item, hit);
    out.previews += 1;
  }

  if (dirty) await q(`UPDATE mixes SET payload = $2 WHERE id = $1`, [mr.id, JSON.stringify(mr.payload)]);
  return out;
}
