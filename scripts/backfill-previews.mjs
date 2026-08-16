#!/usr/bin/env node
// Preview backfill — loose-match edition (promoted from the demo-page
// sweep, Tony 2026-08-16). The strict version required near-equal album
// titles and its last corpus run stored 3 of 172: iTunes decorates titles
// with parentheticals ("(1945-1949)", "(Remastered)", "(Deluxe Edition)")
// and subtitle drift that exact matching can never survive. This matcher
// tolerates exactly that — stripped parentheticals, containment when the
// shorter side is distinctive, token-subset ignoring the creator's own
// name — while keeping the identity gate hard: artist congruence required,
// and a wrong preview is worse than silence (the SEVENTEEN lesson: Apple's
// search happily returns K-pop for "The Coup Party Music"; the gate is
// what keeps it off the card).
//
// Works card-by-card from the latest mix per subject, so creator
// congruence comes from the card itself. Stamps the work ENTITY (serve-
// time hydration picks it up with no deploy), always WITH its creator —
// creator-less entities hold media the identity gate then refuses to
// serve (the invisible-Punisher lesson, 2026-08-14). Falls back to Deezer
// per card, stamping preview_source so the player credits the right
// service.
//
//   node scripts/backfill-previews.mjs [--subject "Name"] [--cut ID] [--dry] [--limit N]

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
const sFlag = process.argv.indexOf("--subject");
const ONLY_SUBJECT = sFlag === -1 ? null : process.argv[sFlag + 1];
const cFlag = process.argv.indexOf("--cut");
const CUT = cFlag === -1 ? null : process.argv[cFlag + 1];
const lFlag = process.argv.indexOf("--limit");
const LIMIT = lFlag === -1 ? null : parseInt(process.argv[lFlag + 1], 10);

const nrm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const toks = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().match(/[a-z]+/g) || [];
const stripParen = (s) => (s || "").replace(/\s*[([].*?[)\]]\s*/g, " ").trim();

function titleOk(ours, theirs, creator) {
  const a = nrm(stripParen(ours)), b = nrm(stripParen(theirs));
  if (!a || !b) return false;
  if (a === b) return true;
  // containment only when the shorter side is distinctive enough ("Home"
  // must not match "Homecoming")
  const shorter = a.length <= b.length ? a : b;
  if (shorter.length >= 8 && (a.includes(b) || b.includes(a))) return true;
  // token-subset ignoring the creator's own name tokens (handles
  // "Bach: Sonatas and Partitas…" vs a BWV-numbered card title)
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

async function itunes(params) {
  const u = new URL(`https://itunes.apple.com/${params.lookup ? "lookup" : "search"}`);
  for (const [k, v] of Object.entries(params)) if (k !== "lookup") u.searchParams.set(k, v);
  return (await fetch(u, { headers: UA })).json();
}

async function findPreview(title, creator) {
  // 1) album route: loose title match on the album, then a previewable track
  await pause(3400);
  try {
    const alb = await itunes({ term: `${creator} ${title}`, media: "music", entity: "album", limit: "10" });
    for (const a of alb.results || []) {
      if (!titleOk(title, a.collectionName, creator)) continue;
      if (!creatorOk(a.artistName, creator) && !nrm(a.collectionName).includes(nrm(creator.split(/\s+/).pop()))) continue;
      await pause(3400);
      const d = await itunes({ lookup: true, id: String(a.collectionId), entity: "song", limit: "60" });
      const t = (d.results || []).find((x) => x.wrapperType === "track" && x.previewUrl);
      if (t) return { url: t.previewUrl, page: t.trackViewUrl || a.collectionViewUrl, source: null, label: `"${t.trackName}" on ${a.collectionName}` };
    }
    // 2) song route: the title itself may be a song
    await pause(3400);
    const s = await itunes({ term: `${creator} ${title}`, media: "music", entity: "song", limit: "10" });
    for (const t of s.results || []) {
      if (!t.previewUrl || !creatorOk(t.artistName, creator)) continue;
      if (titleOk(title, t.trackName, creator) || titleOk(title, t.collectionName, creator))
        return { url: t.previewUrl, page: t.trackViewUrl, source: null, label: `"${t.trackName}"` };
    }
  } catch { /* fall through */ }
  // 3) Deezer — carries catalogs Apple structurally lacks (The Coup lesson)
  try {
    await pause(600);
    const dz = await (await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(`artist:"${creator}" album:"${stripParen(title)}"`)}&limit=5`,
      { headers: UA })).json();
    const hit = (dz.data || []).find((t) => t.preview && creatorOk(t.artist?.name, creator) &&
      (titleOk(title, t.album?.title, creator) || titleOk(title, t.title, creator)));
    if (hit) return {
      url: hit.preview,
      page: hit.album?.id ? `https://www.deezer.com/album/${hit.album.id}` : hit.link,
      source: "Deezer", label: `"${hit.title}" (Deezer)`,
    };
  } catch { /* silence beats a wrong preview */ }
  return null;
}

// ── main: card-by-card over the latest mix per subject ──
const mixes = (await q(`
  SELECT DISTINCT ON (m.subject_entity_id) e.name, m.payload
  FROM mixes m JOIN entities e ON e.id = m.subject_entity_id
  ${ONLY_SUBJECT ? "WHERE lower(e.name) = lower($1)" : ""}
  ORDER BY m.subject_entity_id, m.created_at DESC`,
  ONLY_SUBJECT ? [ONLY_SUBJECT] : []
)).rows.filter((r) => (CUT ? r.payload?.cut?.id === CUT : true));

let applied = 0, had = 0, missed = 0, tried = 0;
outer: for (const mix of mixes) {
  let announced = false;
  for (const slot of mix.payload.slots || []) {
    for (const c of slot.candidates || []) {
      const it = c.item || {};
      if (!it.title || !it.creator || it.medium !== "music" || it.previewUrl) continue;
      // entity state is the serve-time truth (title + creator congruence)
      const ents = (await q(`
        SELECT id, metadata->>'creator' AS creator, metadata->>'preview_url' AS preview
        FROM entities WHERE regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = $1`,
        [nrm(it.title)])).rows;
      const ent = ents.length > 1 ? ents.find((e) => nrm(e.creator) === nrm(it.creator)) : ents[0];
      if (ent?.preview) { had += 1; continue; }
      if (LIMIT && tried >= LIMIT) break outer;
      tried += 1;
      if (!announced) { console.log(`── ${mix.name}`); announced = true; }
      const hit = await findPreview(it.title, it.creator);
      if (!hit) { missed += 1; console.log(`  ✗ ${it.title} — ${it.creator}`); continue; }
      applied += 1;
      console.log(`  ♪ ${it.title} — ${it.creator} → ${hit.label}`);
      if (!DRY) {
        const media = { preview_url: hit.url, preview_page: hit.page, ...(hit.source ? { preview_source: hit.source } : {}) };
        if (ent) {
          await q(`UPDATE entities SET metadata = metadata || $2::jsonb WHERE id = $1`,
            [ent.id, JSON.stringify({ ...(ent.creator ? {} : { creator: it.creator }), ...media })]);
        } else {
          await q(`INSERT INTO entities (kind, domain, name, metadata) VALUES ('work', 'music', $1, $2::jsonb)`,
            [it.title, JSON.stringify({ creator: it.creator, ...media })]);
        }
      }
    }
  }
}
console.log(`\napplied: ${applied} | already had: ${had} | missed: ${missed}${DRY ? " (dry)" : ""}`);
await getPool().end();
