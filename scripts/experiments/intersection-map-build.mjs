// The family intersection map (Tony, 2026-08-17): two listening histories,
// one shared ancestry. Deterministic, local, zero model calls. Stores only
// the derived intersection — same privacy posture as the personal maps.
//   node scripts/experiments/intersection-map-build.mjs data/listening/tony Tony data/listening/august August family-tony-august [--subtract data/listening/eva Eva]
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of readFileSync(`${ROOT}/.env.local`, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { q, getPool } = await import(`${ROOT}/src/lib/db.js`);
const { slugify } = await import(`${ROOT}/src/lib/slug.js`);

const [dirA, nameA, dirB, nameB, SLUG] = process.argv.slice(2);
// --subtract <dir> <name>: remove a third household member's dominant
// artists from BOTH sides (she hijacks both cars). Same rule as the
// personal maps: theirs >= 3h and >= this side's hours. Estimate, labeled.
const subFlag = process.argv.indexOf("--subtract");
const SUB_DIR = subFlag === -1 ? null : process.argv[subFlag + 1];
const SUB_NAME = subFlag === -1 ? null : (process.argv[subFlag + 2] || "them");
const nrm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const NOISE = /white noise|brown noise|pink noise|sleep|rain sound|nature sound|ambient noise|noise therapy|baby lullab|수면|빗소리|白噪音|asmr/i;

function ingest(dir) {
  const files = [];
  for (const sub of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (!sub.isDirectory() || /kids/i.test(sub.name)) continue;
    for (const f of readdirSync(path.join(ROOT, dir, sub.name)))
      if (/^Streaming_History_Audio.*\.json$/.test(f)) files.push(path.join(ROOT, dir, sub.name, f));
  }
  const byArtist = new Map();
  const CUTOFF = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  let plays = 0, ms = 0, first = null, last = null;
  for (const f of files) for (const r of JSON.parse(readFileSync(f, "utf8"))) {
    const artist = r.master_metadata_album_artist_name;
    if (!artist || !r.ms_played || r.ms_played < 30_000) continue;
    plays += 1; ms += r.ms_played;
    if (!first || r.ts < first) first = r.ts;
    if (!last || r.ts > last) last = r.ts;
    const a = byArtist.get(artist) || { ms: 0, tracks: new Set(), recentMs: 0, days: new Set() };
    a.ms += r.ms_played; a.tracks.add(r.master_metadata_track_name || "?");
    if ((r.ts || "") >= CUTOFF) { a.recentMs += r.ms_played; a.days.add((r.ts || "").slice(0, 10)); }
    byArtist.set(artist, a);
  }
  let artists = [...byArtist.entries()]
    .map(([name, a]) => ({ name, hours: a.ms / 3.6e6, tracks: a.tracks.size, recentHours: a.recentMs / 3.6e6, days: a.days }))
    .filter((a) => !(NOISE.test(a.name) || (a.hours / Math.max(1, a.tracks)) > 3))
    .sort((x, y) => y.hours - x.hours);
  const folded = [];
  for (const a of artists) {
    const host = folded.find((f) => a.name !== f.name
      && Math.min(a.name.split(/\s+/).length, f.name.split(/\s+/).length) >= 2
      && (nrm(a.name).includes(nrm(f.name)) || nrm(f.name).includes(nrm(a.name))));
    if (host) {
      const shorter = nrm(host.name).includes(nrm(a.name)) ? a.name : host.name;
      host.hours += a.hours; host.tracks += a.tracks; host.name = shorter;
      host.recentHours += a.recentHours; for (const d of a.days) host.days.add(d);
    } else folded.push({ ...a, days: new Set(a.days) });
  }
  return { artists: folded.sort((x, y) => y.hours - x.hours), plays, hours: Math.round(ms / 3.6e6), from: first?.slice(0, 10), to: last?.slice(0, 10) };
}

const A = ingest(dirA), B = ingest(dirB);
if (SUB_DIR) {
  const SUB = ingest(SUB_DIR);
  const subHours = new Map(SUB.artists.map((a) => [nrm(a.name), a.hours]));
  for (const side of [A, B]) {
    const kept = side.artists.filter((a) => !((subHours.get(nrm(a.name)) || 0) >= 3 && (subHours.get(nrm(a.name)) || 0) >= a.hours));
    console.log(`subtracted ${side.artists.length - kept.length} ${SUB_NAME}-dominant artists from one side`);
    side.artists = kept;
  }
}
const heardA = new Set(A.artists.map((a) => nrm(a.name)));
const heardB = new Set(B.artists.map((a) => nrm(a.name)));
const hoursA = new Map(A.artists.map((a) => [nrm(a.name), a]));
const hoursB = new Map(B.artists.map((a) => [nrm(a.name), a]));
console.log(`${nameA}: ${A.hours}h ${A.artists.length} artists | ${nameB}: ${B.hours}h ${B.artists.length} artists`);

const ents = (await q(`SELECT id, name, kind FROM entities WHERE kind IN ('person','group','other')`)).rows;
const entByNorm = new Map(ents.map((e) => [nrm(e.name), e]));
const subjectIds = new Set((await q(`SELECT DISTINCT subject_entity_id FROM mixes`)).rows.map((r) => r.subject_entity_id));
const linkFor = (name) => { const e = entByNorm.get(nrm(name)); return e && subjectIds.has(e.id) ? `/s/${slugify(name)}` : null; };

// ── the common spine ──
const shared = [];
for (const a of A.artists) {
  const b = hoursB.get(nrm(a.name));
  if (b) shared.push({ name: a.name, [nameA.toLowerCase()]: Math.round(a.hours), [nameB.toLowerCase()]: Math.round(b.hours), combined: Math.round(a.hours + b.hours), href: linkFor(a.name) });
}
shared.sort((x, y) => y.combined - x.combined);
const overlapCount = shared.length;

// ── handoffs: depth vs depth (>=8h and >=5x the other's) ──
const handoff = (from, otherMap) => from
  .filter((a) => a.hours >= 8 && a.hours >= 5 * ((otherMap.get(nrm(a.name))?.hours) || 0))
  .slice(0, 12)
  .map((a) => ({ name: a.name, hours: Math.round(a.hours), href: linkFor(a.name) }));
const aToB = handoff(A.artists, hoursB);
const bToA = handoff(B.artists, hoursA);

// ── listening together: resonance, not attribution ──
const together = [];
for (const a of A.artists) {
  if (a.recentHours < 1) continue;
  const b = hoursB.get(nrm(a.name));
  if (!b || b.recentHours < 1) continue;
  const sharedDays = [...a.days].filter((d) => b.days.has(d)).length;
  together.push({
    name: a.name,
    [nameA.toLowerCase()]: Math.round(a.recentHours * 10) / 10,
    [nameB.toLowerCase()]: Math.round(b.recentHours * 10) / 10,
    sharedDays, href: linkFor(a.name),
  });
}
together.sort((x, y) => y.sharedDays - x.sharedDays || (y[nameA.toLowerCase()] + y[nameB.toLowerCase()]) - (x[nameA.toLowerCase()] + x[nameB.toLowerCase()]));

// ── common roots: documented ancestors reachable from BOTH spines ──
const topA = new Set(A.artists.slice(0, 40).map((a) => a.name));
const topB = new Set(B.artists.slice(0, 40).map((a) => a.name));
const matchedIds = [...new Set([...topA, ...topB])]
  .map((n) => entByNorm.get(nrm(n))).filter(Boolean).map((e) => e.id);
const edges = (await q(`
  SELECT s.name AS subj, o.name AS obj, o.kind AS obj_kind, o.metadata->>'creator' AS obj_creator, c.claim_type,
         (SELECT count(*) FROM provenance p WHERE p.claim_id = c.id AND p.verification_status IN ('quote_confirmed','db_relationship')) AS receipts
  FROM claims c JOIN entities s ON s.id = c.subject_id JOIN entities o ON o.id = c.object_id
  WHERE c.subject_id = ANY($1) AND c.claim_type IN ('influenced_by','cited_as_influence')`, [matchedIds])).rows;
const roots = new Map();
for (const e of edges) {
  if (Number(e.receipts) < 1) continue;
  const k = `${e.obj}|${e.obj_creator || ""}`;
  const v = roots.get(k) || { name: e.obj, kind: e.obj_kind, creator: e.obj_creator, viaA: new Set(), viaB: new Set(), receipts: 0 };
  if (topA.has(e.subj)) v.viaA.add(e.subj);
  if (topB.has(e.subj)) v.viaB.add(e.subj);
  v.receipts += Number(e.receipts);
  roots.set(k, v);
}
const commonRoots = [...roots.values()]
  .filter((r) => r.viaA.size && r.viaB.size)
  .map((r) => ({
    name: r.name, kind: r.kind, creator: r.creator || null, receipts: r.receipts,
    viaA: [...r.viaA], viaB: [...r.viaB],
    heardBy: (heardA.has(nrm(r.kind === "work" ? r.creator || "" : r.name)) ? 1 : 0) + (heardB.has(nrm(r.kind === "work" ? r.creator || "" : r.name)) ? 2 : 0),
    href: linkFor(r.kind === "work" ? r.creator || r.name : r.name),
  }))
  .sort((x, y) => (y.viaA.length + y.viaB.length) - (x.viaA.length + x.viaB.length) || y.receipts - x.receipts)
  .slice(0, 14);

const payload = {
  kind: "intersection",
  person: `${nameA} & ${nameB}`,
  a: { name: nameA, plays: A.plays, hours: A.hours, artists: A.artists.length, from: A.from, to: A.to },
  b: { name: nameB, plays: B.plays, hours: B.hours, artists: B.artists.length, from: B.from, to: B.to },
  built: new Date().toISOString(),
  overlapCount,
  shared: shared.slice(0, 20),
  aToB, bToA, commonRoots, together: together.slice(0, 14),
  note: `${SUB_NAME ? `${SUB_NAME}’s car-hijack listening subtracted from both sides (an estimate, same rule as the personal maps). ` : ""}Two Spotify privacy exports, one shared ancestry. Raw histories stay on the family machine; this page holds only the intersection. Private — behind the site password.`,
};
await q(`INSERT INTO listening_maps (slug, person, payload) VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET payload = $3, person = $2, created_at = now()`,
  [SLUG, payload.person, JSON.stringify(payload)]);
console.log(`\nstored ${SLUG}: shared ${overlapCount} artists | handoffs ${aToB.length}/${bToA.length} | common roots ${commonRoots.length}`);
await getPool().end();
