// Persistence layer (V3-17): every runtime-derived claim, verification, and
// mix is written to the claims store, so each user search permanently
// enriches the graph — the flywheel's first turn (MASTERPLAN Phase A).
//
// All writes are best-effort: callers wrap in try/catch and a persistence
// failure must never break serving a request.

import { q, dbConfigured } from "./db.js";

const DOMAINS = new Set(["music", "film", "television", "literature", "art", "design", "architecture", "theater", "other"]);
const KINDS = new Set(["person", "group", "work", "release", "recording", "film", "tv_show", "book", "place", "other"]);

const domainOf = (d) => (DOMAINS.has(d) ? d : "other");
const kindOf = (k) => (KINDS.has(k) ? k : "other");
const yearOf = (y) => {
  const n = parseInt(String(y || "").slice(0, 4), 10);
  return Number.isFinite(n) && n > 0 && n < 3000 ? n : null;
};

/** Find-or-create an entity, keyed on the strongest available canonical ID. */
export async function upsertEntity({ name, kind = "other", domain = "other", mbid = null, wikidata_qid = null, year = null, metadata = {} }) {
  if (!dbConfigured() || !name) return null;
  if (mbid) {
    const r = await q("SELECT id FROM entities WHERE mbid = $1", [mbid]);
    if (r.rows[0]) return r.rows[0].id;
  }
  if (wikidata_qid) {
    const r = await q("SELECT id FROM entities WHERE wikidata_qid = $1", [wikidata_qid]);
    if (r.rows[0]) return r.rows[0].id;
  }
  if (!mbid && !wikidata_qid) {
    const r = await q(
      "SELECT id FROM entities WHERE lower(name) = lower($1) AND domain = $2 AND kind = $3 LIMIT 1",
      [name, domainOf(domain), kindOf(kind)]
    );
    if (r.rows[0]) return r.rows[0].id;
  }
  const r = await q(
    `INSERT INTO entities (kind, domain, name, year_start, mbid, wikidata_qid, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [kindOf(kind), domainOf(domain), name, yearOf(year), mbid, wikidata_qid, JSON.stringify(metadata)]
  );
  return r.rows[0].id;
}

/** Log a search (feeds Zipf prioritization of the research queue). */
export async function recordSearch(rawQuery, subject, tier) {
  if (!dbConfigured()) return;
  const entityId = subject
    ? await upsertEntity({ name: subject.name, kind: subject.kind, domain: subject.domain, mbid: subject.mbid, wikidata_qid: subject.wikidata_qid })
    : null;
  await q(
    "INSERT INTO query_log (raw_query, resolved_entity_id, disambiguation_tier) VALUES ($1, $2, $3)",
    [rawQuery, entityId, tier || null]
  );
}

// slotType → (claim_type, direction). Legacy claims reverse subject/object:
// "X is a legacy of S" is stored as influenced_by(X, S) per the schema's
// inverse-read convention. Essential items are the subject's own canon — no claim.
const SLOT_CLAIMS = {
  titan: { type: "influenced_by", reversed: false },
  ghost: { type: "influenced_by", reversed: false },
  culture: { type: "cross_medium_influence", reversed: false },
  geography: { type: "same_scene", reversed: false },
  peer: { type: "same_scene", reversed: false },
  legacy: { type: "influenced_by", reversed: true },
  collaborator: { type: "collaborated_with", reversed: false },
};

async function findOrCreateClaim({ subjectId, objectId, claimType, slotType, summary, via }) {
  const existing = await q(
    "SELECT id FROM claims WHERE subject_id = $1 AND object_id = $2 AND claim_type = $3 LIMIT 1",
    [subjectId, objectId, claimType]
  );
  if (existing.rows[0]) return { id: existing.rows[0].id, created: false };
  const r = await q(
    `INSERT INTO claims (subject_id, object_id, claim_type, slot_affinity, summary, origin, model_version, agent_run_id)
     VALUES ($1, $2, $3, $4, $5, 'runtime_generation', $6, $7) RETURNING id`,
    [subjectId, objectId, claimType, [slotType], summary, process.env.KYNDA_MODEL_VERSION || "claude-fable-5", via || null]
  );
  return { id: r.rows[0].id, created: true };
}

async function addProvenance(claimId, { status, method, url = null, quote = null, notes = null }) {
  await q(
    `INSERT INTO provenance (claim_id, source_url, quote, verification_status, verification_method, verified_at, retrieved_at, notes)
     VALUES ($1, $2, $3, $4, $5, now(), now(), $6)`,
    [claimId, url, quote, status, method, notes]
  );
}

/**
 * Persist a completed mix run: subject + one claim per non-essential item,
 * with provenance rows mirroring the machine verifications, plus the mix
 * payload itself (the durable L2 cache).
 */
export async function persistMixRun({ subject, rawQuery = null, intro, entries }) {
  if (!dbConfigured()) return;

  const subjectId = await upsertEntity({
    name: subject.name,
    kind: subject.kind,
    domain: subject.domain,
    mbid: subject.mbid,
    wikidata_qid: subject.wikidata_qid,
  });
  if (!subjectId) return;

  for (const { item, verification } of entries) {
    const mapping = SLOT_CLAIMS[item.slotType];
    if (!mapping) continue;

    const workId = await upsertEntity({
      name: item.title,
      kind: "work",
      domain: item.medium,
      year: item.year,
      metadata: { creator: item.creator },
    });
    if (!workId || workId === subjectId) continue;

    const [sId, oId] = mapping.reversed ? [workId, subjectId] : [subjectId, workId];
    const { id: claimId, created } = await findOrCreateClaim({
      subjectId: sId,
      objectId: oId,
      claimType: mapping.type,
      slotType: item.slotType,
      summary: `${item.title} (${item.creator}) — ${item.slotType} for ${subject.name}`,
      via: item.via,
    });
    // Only attach provenance the first time we see this claim — re-serving a
    // cached mix should not duplicate evidence rows.
    if (!created) continue;

    const a = verification?.attribution;
    if (a?.status === "verified") {
      await addProvenance(claimId, {
        status: "db_relationship", method: a.method || a.source, url: a.url,
        notes: `attribution confirmed in ${a.source}${a.detail ? ` (${a.detail})` : ""}`,
      });
    } else if (a?.status === "not_found") {
      await addProvenance(claimId, {
        status: "unverifiable", method: a.source,
        notes: "attribution failed fact-check — possible misattribution",
      });
    }

    const c = verification?.connection;
    if (c?.status === "documented") {
      await addProvenance(claimId, {
        status: "quote_confirmed", method: "wikipedia_cross_mention", url: c.url, quote: c.excerpt,
        notes: `mention in ${c.articleTitle}`,
      });
    } else if (c?.status === "documented_via") {
      if (c.hop1.kind === "membership") {
        await addProvenance(claimId, {
          status: "db_relationship", method: "musicbrainz_membership", url: c.hop1.url,
          notes: `hop 1: ${c.via} — ${c.hop1.label}`,
        });
      } else {
        await addProvenance(claimId, {
          status: "quote_confirmed", method: "wikipedia_cross_mention", url: c.hop1.url, quote: c.hop1.excerpt,
          notes: `hop 1: ${c.via} in ${c.hop1.articleTitle}`,
        });
      }
      await addProvenance(claimId, {
        status: "quote_confirmed", method: "wikipedia_cross_mention", url: c.hop2.url, quote: c.hop2.excerpt,
        notes: `hop 2 via ${c.via}: ${c.hop2.articleTitle}`,
      });
    }
  }

  await q(
    "INSERT INTO mixes (subject_entity_id, payload, source, model_version) VALUES ($1, $2, 'generated', $3)",
    [subjectId, JSON.stringify({ intro, entries }), process.env.KYNDA_MODEL_VERSION || "claude-fable-5"]
  );

  if (rawQuery) {
    await q(
      "INSERT INTO query_log (raw_query, resolved_entity_id) VALUES ($1, $2)",
      [rawQuery, subjectId]
    ).catch(() => {});
  }
}

/** Durable L2 mix cache: most recent stored mix for this subject (6-month TTL). */
export async function getStoredMix(subject) {
  if (!dbConfigured()) return null;
  const clauses = [];
  const params = [];
  if (subject.mbid) { params.push(subject.mbid); clauses.push(`e.mbid = $${params.length}`); }
  if (subject.wikidata_qid) { params.push(subject.wikidata_qid); clauses.push(`e.wikidata_qid = $${params.length}`); }
  if (!clauses.length) { params.push(subject.name); clauses.push(`lower(e.name) = lower($${params.length})`); }
  const r = await q(
    `SELECT m.payload FROM mixes m JOIN entities e ON e.id = m.subject_entity_id
     WHERE (${clauses.join(" OR ")}) AND m.created_at > now() - interval '180 days'
     ORDER BY m.created_at DESC LIMIT 1`,
    params
  );
  return r?.rows[0]?.payload || null;
}
