// Map images (2026-10-02): a rights-cleared picture for every person, work
// and institution on the influence map — or none. Zero model calls.
//
// Identity first, then rights:
//   WORKS reuse the mix-card path exactly — the en-wiki article must match
//     the title and name the creator; Commons free licenses apply, non-free
//     art applies only under the settled fair-use class rules (cover art,
//     posters, title cards, jackets).
//   PEOPLE AND INSTITUTIONS carry almost no identifiers in the store, so
//     identity comes from context: the claim summaries that connect them to
//     the map ("Vonnegut studied under anthropologist Robert Redfield"). An
//     article only counts as theirs when its description shares a role word
//     with that context, or its lead names someone they're connected to.
//     Their pictures must be freely licensed — never fair use.
// Anything not certain enough to apply on its own becomes a candidate for a
// curator (the /admin/images queue and the in-page admin overlay).

import { q } from "../db.js";
import { enwiki, findArticleImage, fileInfo, fairUseClass, ALLOWLIST, UA } from "./media.js";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const nrm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Role words that identify who or what an article is about. Matching one in
// both the claim context and the article's description is the identity gate.
const ROLES = [
  "novelist", "writer", "author", "poet", "essayist", "journalist", "critic", "editor", "satirist", "humorist",
  "playwright", "dramatist", "screenwriter", "philosopher", "theologian", "historian", "anthropologist",
  "sociologist", "economist", "psychologist", "scientist", "physicist", "chemist", "biologist", "mathematician",
  "astronomer", "inventor", "engineer", "director", "filmmaker", "producer", "actor", "actress", "comedian",
  "musician", "singer", "songwriter", "composer", "conductor", "pianist", "guitarist", "drummer", "rapper", "dj",
  "band", "orchestra", "painter", "sculptor", "artist", "illustrator", "cartoonist", "photographer", "architect",
  "designer", "dancer", "choreographer", "politician", "activist", "socialist", "lawyer", "president", "teacher",
  "professor", "university", "college", "school", "institute", "academy", "workshop", "company", "corporation",
  "conglomerate", "manufacturer", "label", "studio", "magazine", "newspaper", "publisher", "museum", "theatre",
  "theater", "association", "society", "organization", "church", "army", "navy", "cook", "chef",
];
const rolesIn = (text) => {
  const t = ` ${nrm(text).replace(/[^a-z]+/g, " ")} `;
  return new Set(ROLES.filter((r) => t.includes(` ${r} `) || t.includes(` ${r}s `)));
};
// Context rarely names a role outright ("compares Beloved to Twain"), but it names the kind of
// work — so a work word in the context stands for the roles that make that kind of work.
const FAMILIES = [
  [["novel", "novels", "fiction", "book", "books", "literary", "literature", "prose", "satire", "stories", "story", "poem", "poems", "poetry"],
    ["novelist", "writer", "author", "poet", "essayist", "humorist", "satirist", "journalist", "critic", "playwright"]],
  [["film", "films", "movie", "movies", "cinema", "screen"], ["director", "filmmaker", "actor", "actress", "screenwriter", "producer"]],
  [["album", "albums", "song", "songs", "music", "record", "records", "recording", "jazz", "rock", "blues"], ["musician", "singer", "songwriter", "composer", "band", "pianist", "guitarist", "rapper"]],
  [["painting", "paintings", "canvas", "gallery"], ["painter", "artist"]],
  [["philosophy", "philosophical"], ["philosopher"]],
  [["building", "buildings", "architecture"], ["architect"]],
  [["dance", "choreography"], ["dancer", "choreographer"]],
  [["comedy", "comedies", "comic", "stand"], ["comedian", "playwright", "dramatist"]],
  [["play", "plays", "theatre", "theater", "stage", "tragedy"], ["playwright", "dramatist", "actor", "actress"]],
];
const contextRoles = (text) => {
  const roles = rolesIn(text);
  const words = new Set(nrm(text).split(/[^a-z]+/));
  for (const [cues, fam] of FAMILIES) if (cues.some((c) => words.has(c))) fam.forEach((r) => roles.add(r));
  return roles;
};

const MEDIUM = { literature: "literature", film: "film", music: "music", television: "television", comedy: "television" };

/** What the store says about how this entity sits on the map. */
export async function entityContext(entityId) {
  const r = await q(
    `SELECT c.summary, o.name
     FROM claims c JOIN entities o ON o.id = CASE WHEN c.subject_id = $1 THEN c.object_id ELSE c.subject_id END
     WHERE c.subject_id = $1 OR c.object_id = $1
     LIMIT 25`, [entityId]);
  const summaries = r.rows.map((x) => x.summary).filter(Boolean);
  return { summaries, connected: [...new Set(r.rows.map((x) => x.name))], roles: contextRoles(summaries.join(" ")) };
}

async function articles(titles) {
  const d = await enwiki({
    action: "query", titles, redirects: "1", prop: "pageprops|pageimages|description|extracts",
    piprop: "name", exintro: "1", explaintext: "1", exsentences: "2",
  });
  return Object.values(d.query?.pages || {}).filter((p) => p.missing === undefined);
}

// Roles that describe the same kind of person: "favorite writer" in the context and
// "English author and journalist" in the article are the same claim of identity.
const GROUPS = [
  ["novelist", "writer", "author", "poet", "essayist", "humorist", "satirist", "journalist", "critic", "editor", "playwright", "dramatist", "screenwriter"],
  ["director", "filmmaker", "producer", "screenwriter", "actor", "actress"],
  ["musician", "singer", "songwriter", "composer", "conductor", "pianist", "guitarist", "drummer", "rapper", "dj", "band", "orchestra"],
  ["painter", "sculptor", "artist", "illustrator", "cartoonist", "photographer"],
  ["university", "college", "school", "institute", "academy", "workshop"],
  ["company", "corporation", "conglomerate", "manufacturer"],
];
const group = (r) => GROUPS.findIndex((g) => g.includes(r));
const sameRole = (a, b) => a === b || (group(a) >= 0 && group(a) === group(b));

function identity(page, entity, ctx) {
  const desc = `${page.description || ""} ${(page.extract || "").split(/(?<=[.!?])\s/)[0]}`;
  const shared = [...rolesIn(desc)].filter((r) => [...ctx.roles].some((c) => sameRole(r, c)));
  // A connected name only vouches when it isn't the entity's own name (the novel and the film
  // of "Psycho" are linked to each other; that proves nothing about which article is which).
  const mentions = ctx.connected.filter((n) => n && n.length > 3 && nrm(n) !== nrm(entity.name) && nrm(page.extract).includes(nrm(n)));
  // Exact name only (a "(writer)" qualifier is fine) — "Michael Crichton bibliography" is not Michael Crichton.
  const nameOk = nrm(page.title).replace(/\s*\(.*\)$/, "") === nrm(entity.name);
  return { score: (nameOk ? 1 : 0) + shared.length * 2 + mentions.length * 2, shared, mentions, nameOk };
}

/** Wikidata picture properties: image, logo, then coat of arms. */
async function wikidataFile(qid) {
  const d = await (await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, { headers: UA, signal: AbortSignal.timeout(12000) })).json();
  const claims = d.entities?.[qid]?.claims || {};
  for (const prop of ["P18", "P154", "P94"]) {
    const v = claims[prop]?.[0]?.mainsnak?.datavalue?.value;
    if (v) return { file: v, prop };
  }
  return null;
}

/** A free-licensed Commons picture for an article: its Wikidata image first, then the article's lead image. */
async function freePictureFor(page) {
  const qid = page.pageprops?.wikibase_item;
  if (qid) {
    const wd = await wikidataFile(qid).catch(() => null);
    if (wd) {
      const info = await fileInfo(wd.file).catch(() => null);
      if (info?.host === "commons") return { ...info, via: `Wikidata ${wd.prop === "P154" ? "logo" : "image"}` };
    }
  }
  if (page.pageimage) {
    const info = await fileInfo(page.pageimage).catch(() => null);
    if (info?.host === "commons") return { ...info, via: "Wikipedia lead image" };
  }
  return null;
}

const asCandidate = (source, info, extra = {}) => ({
  source, url: info.url, page: info.page || null, license: info.license || null,
  credit: info.credit || null, fair_use: false, score: 0, ...extra,
});

// ── extra free sources, used only to fill the curator's choices ──
async function commonsSearch(term, limit = 3) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  for (const [k, v] of Object.entries({ action: "query", list: "search", srnamespace: "6", srsearch: `${term} filetype:bitmap`, srlimit: String(limit + 2), format: "json" })) u.searchParams.set(k, v);
  const d = await (await fetch(u, { headers: UA, signal: AbortSignal.timeout(12000) })).json();
  const out = [];
  for (const h of d.query?.search || []) {
    const info = await fileInfo(h.title.replace(/^File:/, "")).catch(() => null);
    if (info?.host === "commons") out.push(asCandidate("commons", info, { title: h.title.replace(/^File:/, ""), description: "Wikimedia Commons search" }));
    if (out.length >= limit) break;
    await pause(80);
  }
  return out;
}

async function openverse(term, limit = 3) {
  const r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(term)}&license=by,by-sa,cc0,pdm&page_size=${limit}`, { headers: UA, signal: AbortSignal.timeout(12000) });
  if (!r.ok) return [];
  const d = await r.json();
  return (d.results || []).map((x) => asCandidate("openverse", {
    url: x.thumbnail || x.url, page: x.foreign_landing_url || x.url,
    license: x.license === "pdm" ? "Public domain" : x.license === "cc0" ? "CC0" : `CC ${x.license.toUpperCase()} ${x.license_version || ""}`.trim(),
    credit: (x.creator || x.source || "Openverse").slice(0, 120),
  }, { title: x.title || null, description: `Openverse · ${x.source || ""}`.trim() }));
}

async function libraryOfCongress(name, limit = 2) {
  const d = await (await fetch(`https://www.loc.gov/photos/?q=${encodeURIComponent(name)}&fo=json&c=8`, { headers: UA, signal: AbortSignal.timeout(12000) })).json();
  const out = [];
  for (const r of d.results || []) {
    if (!nrm(r.title).includes(nrm(name))) continue; // LoC search is loose; the name must be in the title
    const img = (r.image_url || []).filter((u) => /\.(jpe?g|gif|png)/i.test(u)).pop();
    if (!img || !r.id) continue;
    const item = await (await fetch(`${r.id.replace(/\/$/, "")}/?fo=json`, { headers: UA, signal: AbortSignal.timeout(12000) })).json().catch(() => null);
    const rights = [item?.item?.rights_advisory, item?.item?.rights].flat().filter(Boolean).join(" ");
    if (!/no known restrictions/i.test(rights)) continue;
    out.push(asCandidate("loc", { url: img, page: r.id, license: "No known restrictions (Library of Congress)", credit: "Library of Congress" },
      { title: r.title.slice(0, 160), description: (r.date ? `${r.date} · ` : "") + "Library of Congress" }));
    if (out.length >= limit) break;
  }
  return out;
}

async function coverArt(title, creator) {
  const mb = await (await fetch(`https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(`releasegroup:"${title}" AND artist:"${creator}"`)}&fmt=json&limit=2`, { headers: UA, signal: AbortSignal.timeout(12000) })).json();
  const out = [];
  for (const rg of mb["release-groups"] || []) {
    if ((rg.score || 0) < 90) continue;
    const r = await fetch(`https://coverartarchive.org/release-group/${rg.id}`, { headers: UA, signal: AbortSignal.timeout(12000) });
    if (!r.ok) continue;
    const front = (await r.json()).images?.find((i) => i.front);
    if (!front) continue;
    out.push({
      source: "coverart", url: front.thumbnails?.["500"] || front.thumbnails?.large || front.image,
      page: `https://musicbrainz.org/release-group/${rg.id}`, license: "fair use — cover art thumbnail",
      credit: "Cover Art Archive", title: rg.title, description: `${rg["primary-type"] || "Release"} · ${rg["artist-credit"]?.[0]?.name || creator}`,
      fair_use: true, score: 2,
    });
  }
  return out;
}

const isWork = (e) => e.kind === "work" && !!e.metadata?.creator;

/**
 * Look for a picture for one entity.
 * Returns { auto, candidates, note }: `auto` is safe to apply without a
 * curator (identity and rights both settled); `candidates` are for review.
 * `query` (curator-typed) widens the search and never auto-applies.
 */
export async function findEntityImage(entity, { query = null } = {}) {
  const ctx = await entityContext(entity.id);
  const candidates = [];
  let auto = null;

  if (isWork(entity) && !query) {
    const medium = MEDIUM[entity.domain] || null;
    const found = await findArticleImage(entity.name, entity.metadata.creator, medium).catch(() => null);
    const info = found ? await fileInfo(found.file).catch(() => null) : null;
    if (info?.host === "commons") {
      auto = asCandidate("enwiki", info, { title: found.article, description: "Matched by title and creator", identity: "work gates" });
    } else if (info?.url) {
      const cls = fairUseClass({ medium }, found.extract);
      if (cls) auto = { source: "enwiki", url: info.url, page: info.page, license: cls.license, credit: `en.wikipedia (${found.article})`, title: found.article, description: "Matched by title and creator", fair_use: true, identity: "work gates" };
    }
    if (!auto && medium === "music") candidates.push(...await coverArt(entity.name, entity.metadata.creator).catch(() => []));
  }

  if (!auto) {
    // Wikipedia articles that could be this entity: a confirmed Wikidata ID, the exact name,
    // then a search sharpened with the strongest role word from its context.
    const role = [...ctx.roles][0] || "";
    const pages = new Map();
    const add = (list) => { for (const p of list) if (!pages.has(p.title)) pages.set(p.title, p); };
    if (entity.wikidata_qid && !query) {
      const wd = await wikidataFile(entity.wikidata_qid).catch(() => null);
      const info = wd ? await fileInfo(wd.file).catch(() => null) : null;
      if (info?.host === "commons") auto = asCandidate("wikidata", info, { title: entity.wikidata_qid, description: "Confirmed Wikidata ID", identity: "wikidata id" });
    }
    if (!auto) {
      if (!query) add(await articles(entity.name).catch(() => []));
      const s = await enwiki({ action: "query", list: "search", srsearch: query || `${entity.name} ${role}`.trim(), srlimit: "4" }).catch(() => ({}));
      const titles = (s.query?.search || []).map((h) => h.title).filter((t) => !pages.has(t));
      if (titles.length) add(await articles(titles.join("|")).catch(() => []));
      const ranked = [...pages.values()]
        .filter((p) => !("disambiguation" in (p.pageprops || {})))
        .map((p) => ({ p, id: identity(p, entity, ctx) }))
        .sort((a, b) => b.id.score - a.id.score)
        .slice(0, 4);
      for (const { p, id } of ranked) {
        const pic = await freePictureFor(p).catch(() => null);
        if (!pic) continue;
        const cand = asCandidate(pic.via.startsWith("Wikidata") ? "wikidata" : "enwiki", pic, {
          title: p.title, description: p.description || (p.extract || "").slice(0, 140), score: id.score,
          identity: id.shared.length ? `role: ${id.shared.join(", ")}` : id.mentions.length ? `mentions ${id.mentions[0]}` : null,
        });
        // Auto only when the article is unmistakably theirs: their name, plus a shared role
        // word or a mention of someone they're connected to.
        if (!auto && !query && id.nameOk && (id.shared.length || id.mentions.length)) auto = cand;
        else candidates.push(cand);
        await pause(80);
      }
    }
  }

  if (!auto || query) {
    const term = query || entity.name;
    const extra = await Promise.all([
      commonsSearch(term).catch(() => []),
      openverse(term).catch(() => []),
      isWork(entity) ? Promise.resolve([]) : libraryOfCongress(entity.name).catch(() => []),
    ]);
    candidates.push(...extra.flat());
  }

  // One entry per picture, best first; drop anything that doesn't carry the entity's
  // distinguishing name word (a surname, or a title's main word) — searches drift to namesakes.
  const key = nrm(isWork(entity) ? entity.name.replace(/^(the|a|an)\s+/i, "").split(/\s+/)[0] : entity.name.split(/\s+/).pop()).replace(/[^a-z0-9]/g, "");
  const relevant = (c) => c.source === "loc" || c.source === "coverart" || !key || nrm(`${c.title} ${c.page}`).replace(/[^a-z0-9]/g, "").includes(key);
  const seen = new Set(auto ? [auto.url] : []);
  const unique = candidates.filter((c) => c.url && relevant(c) && !seen.has(c.url) && seen.add(c.url)).sort((a, b) => b.score - a.score).slice(0, 9);
  return { auto, candidates: unique, context: ctx.summaries.slice(0, 2) };
}

/** Put a picture on an entity. status: auto (backfill) | approved (curator). */
export async function applyEntityImage(entityId, img, status) {
  await q(`UPDATE entities SET metadata = (metadata - 'image_status') || $2::jsonb, updated_at = now() WHERE id = $1`, [entityId, JSON.stringify({
    image_url: img.url, image_page: img.page || null, image_license: img.license || null, image_credit: img.credit || null,
    image_source: img.source || null, image_identity: img.identity || null, image_fair_use: !!img.fair_use,
    image_status: status, image_checked_at: new Date().toISOString(),
  })]);
}

/** Take a picture off (curator) or record that there is no good one. */
export async function clearEntityImage(entityId, { none = false } = {}) {
  await q(
    `UPDATE entities SET metadata = (metadata - 'image_url' - 'image_page' - 'image_license' - 'image_credit' - 'image_source' - 'image_identity' - 'image_fair_use') || $2::jsonb, updated_at = now() WHERE id = $1`,
    [entityId, JSON.stringify({ image_status: none ? "none" : "removed", image_checked_at: new Date().toISOString() })]);
}

/** Store candidates for the curator queue (skips ones already there). */
export async function saveCandidates(entityId, candidates) {
  for (const c of candidates) {
    await q(
      `INSERT INTO image_candidates (entity_id, source, url, page, license, credit, title, description, fair_use, score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (entity_id, url) DO NOTHING`,
      [entityId, c.source, c.url, c.page, c.license, c.credit, c.title || null, [c.description, c.identity].filter(Boolean).join(" · ") || null, !!c.fair_use, c.score || 0]);
  }
}

/** A curator pasted a Commons file link: accept it only if Commons says it's freely licensed. */
export async function candidateFromCommonsUrl(url) {
  const m = String(url).match(/(?:File:|\/wiki\/File:|upload\.wikimedia\.org\/.+\/)([^/?#]+\.(?:jpe?g|png|gif|tiff?|webp|svg))/i);
  if (!m) return { error: "Paste a Wikimedia Commons file link (commons.wikimedia.org/wiki/File:…)." };
  const file = decodeURIComponent(m[1]).replace(/_/g, " ").replace(/^\d+px-/, "");
  const info = await fileInfo(file).catch(() => null);
  if (info?.host !== "commons") return { error: "That file isn't under a free license on Commons, so Kynda can't use it." };
  if (!ALLOWLIST.test(info.license)) return { error: `License "${info.license}" isn't on the allowlist.` };
  return { candidate: asCandidate("commons", info, { title: file, description: "Pasted by curator", identity: "curator" }) };
}
