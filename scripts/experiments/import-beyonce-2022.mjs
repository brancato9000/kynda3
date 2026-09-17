// The Beyoncé 2022 import — Layer 0 (Tony, 2026-08-17). 593 hand-labeled
// connections from beyonce-connections-2022.xlsx become human-curated
// claims. Where a row carries its Wikipedia evidence passage, the QUOTE
// WALL re-verifies it against the CURRENT article — Tony's 2022 homework
// earning machine receipts four years later. Zero model calls.
//
// Category → claim mapping (taxonomy has no anti_influence yet):
//   1. Influence        → Beyoncé influenced_by ARTIST
//   2. beyonce covered  → Beyoncé covers ARTIST        (artist-level)
//   3. Contemporary     → Beyoncé same_scene ARTIST
//   4. Collaborator     → Beyoncé collaborated_with ARTIST
//   5. Successor        → ARTIST influenced_by Beyoncé
//   6. covered beyonce  → Beyoncé covered_by ARTIST    (artist-level)
//
//   node scripts/experiments/import-beyonce-2022.mjs [--dry]
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of readFileSync(`${ROOT}/.env.local`, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { q, getPool } = await import(`${ROOT}/src/lib/db.js`);
const { upsertEntity } = await import(`${ROOT}/src/lib/store.js`);
const { getArticle } = await import(`${ROOT}/src/lib/entities/wikipedia.js`);

const DRY = process.argv.includes("--dry");
const RUN_ID = "curator_tony_beyonce_2022";

// ── read the sheet via python (no xlsx dep in node) ──
const rowsJson = execSync(`python3 - <<'PY'
import zipfile, json
from xml.etree import ElementTree as ET
z = zipfile.ZipFile("${ROOT}/beyonce-connections-2022.xlsx")
ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
T = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"
shared = ["".join(t.text or "" for t in si.iter(T)) for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", ns)]
sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
def val(c):
    v = c.find("m:v", ns)
    if v is None: return ""
    return shared[int(v.text)] if c.get("t") == "s" else v.text
def col(c): return "".join(ch for ch in c.get("r","") if ch.isalpha())
out = []
for r in sheet.findall(".//m:row", ns)[1:]:
    d = {col(c): val(c) for c in r.findall("m:c", ns)}
    out.append({"artist": d.get("A","").strip(), "source_article": d.get("C","").strip(),
                "year": d.get("D",""), "text": d.get("E","").strip(),
                "category": d.get("F","").strip(), "sub": d.get("G","").strip(), "link": d.get("J","").strip()})
print(json.dumps(out))
PY`, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const rows = JSON.parse(rowsJson).filter((r) => r.artist);
console.log(`rows: ${rows.length}${DRY ? " (dry)" : ""}`);

const MAP = {
  "1. Influence": { type: "influenced_by", reversed: false },
  "2. beyonce covered": { type: "covers", reversed: false },
  "3. Contemporary": { type: "same_scene", reversed: false },
  "4. Collaborator": { type: "collaborated_with", reversed: false },
  "5. Successor": { type: "influenced_by", reversed: true },
  "6. covered beyonce": { type: "covered_by", reversed: false },
};

const bey = (await q(`SELECT id FROM entities WHERE lower(name) = 'beyoncé' OR lower(name) = 'beyonce' ORDER BY (mbid IS NOT NULL) DESC LIMIT 1`)).rows[0];
if (!bey) { console.log("no Beyoncé entity"); process.exit(1); }

// quote wall (same normalization philosophy as the harvest core): try the
// full passage, then sentence-by-sentence, against the CURRENT article.
const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").replace(/[""]/g, '"').replace(/['']/g, "'").trim();
const articleCache = new Map();
async function wallVerify(sourceArticle, passage) {
  if (!sourceArticle || !passage || passage.length < 40) return null;
  if (!articleCache.has(sourceArticle)) {
    articleCache.set(sourceArticle, await getArticle({ name: sourceArticle }).catch(() => null));
    await new Promise((r) => setTimeout(r, 250));
  }
  const art = articleCache.get(sourceArticle);
  if (!art?.text) return null;
  const hay = norm(art.text);
  if (hay.includes(norm(passage))) return { quote: passage, url: art.url, title: art.title };
  for (const sent of passage.split(/(?<=[.!?])\s+/).filter((s) => s.length >= 60).sort((a, b) => b.length - a.length)) {
    if (hay.includes(norm(sent))) return { quote: sent, url: art.url, title: art.title };
  }
  return null;
}

const stats = { created: 0, existed: 0, skippedCat: 0, provenance: 0, wallFailed: 0, byType: {} };
for (const r of rows) {
  const map = MAP[r.category];
  if (!map) { stats.skippedCat += 1; continue; }
  const otherId = await upsertEntity({ name: r.artist, kind: "other", domain: "music",
    year: r.year ? parseInt(r.year) : null });
  if (!otherId || otherId === bey.id) continue;
  const [sId, oId] = map.reversed ? [otherId, bey.id] : [bey.id, otherId];

  const existing = (await q(`SELECT id FROM claims WHERE subject_id = $1 AND object_id = $2 AND claim_type = $3 LIMIT 1`,
    [sId, oId, map.type])).rows[0];
  let claimId = existing?.id;
  if (existing) stats.existed += 1;
  else {
    stats.created += 1;
    stats.byType[map.type] = (stats.byType[map.type] || 0) + 1;
    if (!DRY) {
      claimId = (await q(`
        INSERT INTO claims (subject_id, object_id, claim_type, slot_affinity, summary, origin, agent_run_id)
        VALUES ($1, $2, $3, '{}', $4, 'human_curation', $5) RETURNING id`,
        [sId, oId, map.type,
         `${r.artist} — ${r.category.replace(/^\d+\.\s*/, "")}${r.sub ? ` (${r.sub})` : ""} for Beyoncé · hand-labeled by Tony Brancato, 2022`,
         RUN_ID])).rows[0].id;
    }
  }

  // provenance: only when the wall confirms the passage against TODAY's article
  if (r.text && r.source_article && (claimId || DRY)) {
    const hasProv = claimId ? (await q(`SELECT 1 FROM provenance WHERE claim_id = $1 AND notes LIKE '%2022 spreadsheet%' LIMIT 1`, [claimId])).rows[0] : null;
    if (!hasProv) {
      const hit = await wallVerify(r.source_article, r.text);
      if (hit) {
        stats.provenance += 1;
        if (!DRY && claimId) await q(`
          INSERT INTO provenance (claim_id, source_url, quote, verification_status, verification_method, verified_at, source_degree, notes)
          VALUES ($1, $2, $3, 'quote_confirmed', 'string_match', now(), 'second',
                  'from Tony Brancato''s 2022 spreadsheet; re-verified against the live article at import')`,
          [claimId, hit.url, hit.quote.slice(0, 1500)]);
      } else stats.wallFailed += 1;
    }
  }
}
console.log(JSON.stringify(stats, null, 1));
console.log(DRY ? "(dry — nothing written)" : "done");
await getPool().end();
