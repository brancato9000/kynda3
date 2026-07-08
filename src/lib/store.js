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

async function addProvenance(claimId, { status, method, url = null, quote = null, notes = null, publication = null, publishedDate = null, archivedUrl = null, speaker = null, sourceDegree = null }) {
  await q(
    `INSERT INTO provenance (claim_id, source_url, archived_url, quote, publication, published_date, verification_status, verification_method, verified_at, retrieved_at, notes, speaker, source_degree)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now(), $9, $10, $11)`,
    [claimId, url, archivedUrl, quote, publication, publishedDate || null, status, method, notes, speaker, sourceDegree]
  );
}

/**
 * Persist a completed mix run: subject + one claim per non-essential
 * candidate (every carousel candidate is a claim, V3-19), with provenance
 * rows mirroring the machine verifications, plus the mix payload itself
 * (the durable L2 cache). Accepts {slots} (v2) or legacy {entries}.
 */
export async function persistMixRun({ subject, rawQuery = null, intro, slots = null, entries = null }) {
  if (!dbConfigured()) return;

  const subjectId = await upsertEntity({
    name: subject.name,
    kind: subject.kind,
    domain: subject.domain,
    mbid: subject.mbid,
    wikidata_qid: subject.wikidata_qid,
  });
  if (!subjectId) return;

  const allEntries = slots ? slots.flatMap((slot) => slot.candidates) : entries || [];
  for (const { item, verification } of allEntries) {
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
    [subjectId, JSON.stringify(slots ? { intro, slots } : { intro, entries }), process.env.KYNDA_MODEL_VERSION || "claude-fable-5"]
  );

  if (rawQuery) {
    await q(
      "INSERT INTO query_log (raw_query, resolved_entity_id) VALUES ($1, $2)",
      [rawQuery, subjectId]
    ).catch(() => {});
  }
}

// ─── Research pipeline (MASTERPLAN Phase B) ─────────────────────────────

/** Seed the research queue from the most-searched entities (Zipf). */
export async function enqueueTopSearched(limit = 20) {
  if (!dbConfigured()) return 0;
  const r = await q(
    `INSERT INTO research_queue (entity_id, priority, enqueued_by)
     SELECT resolved_entity_id, count(*)::int, 'query_log'
     FROM query_log
     WHERE resolved_entity_id IS NOT NULL
     GROUP BY resolved_entity_id
     ORDER BY count(*) DESC
     LIMIT $1
     ON CONFLICT (entity_id) DO UPDATE SET priority = EXCLUDED.priority, updated_at = now()`,
    [limit]
  );
  return r.rowCount;
}

export async function enqueueSubjectByName(name) {
  if (!dbConfigured()) return null;
  const e = await q("SELECT id FROM entities WHERE lower(name) = lower($1) ORDER BY created_at LIMIT 1", [name]);
  if (!e.rows[0]) return null;
  await q(
    `INSERT INTO research_queue (entity_id, priority, enqueued_by) VALUES ($1, 100, 'manual')
     ON CONFLICT (entity_id) DO UPDATE SET status = 'queued', priority = 100, updated_at = now()`,
    [e.rows[0].id]
  );
  return e.rows[0].id;
}

export async function nextQueuedSubjects(limit = 5) {
  if (!dbConfigured()) return [];
  const r = await q(
    `SELECT rq.id AS queue_id, e.id, e.name, e.domain, e.kind, e.mbid, e.wikidata_qid
     FROM research_queue rq JOIN entities e ON e.id = rq.entity_id
     WHERE rq.status = 'queued'
     ORDER BY rq.priority DESC, rq.created_at
     LIMIT $1`,
    [limit]
  );
  return r.rows;
}

export async function markResearch(queueId, status, error = null) {
  await q(
    "UPDATE research_queue SET status = $2, last_error = $3, attempts = attempts + 1, updated_at = now() WHERE id = $1",
    [queueId, status, error]
  );
}

/** Known connections for a subject (both directions) — the researcher's targets. */
export async function getClaimTargets(subjectEntityId, limit = 12) {
  if (!dbConfigured()) return [];
  const r = await q(
    `SELECT c.id AS claim_id, c.claim_type,
            o.name AS title, o.metadata->>'creator' AS creator
     FROM claims c JOIN entities o ON o.id = CASE WHEN c.subject_id = $1 THEN c.object_id ELSE c.subject_id END
     WHERE c.subject_id = $1 OR c.object_id = $1
     ORDER BY c.created_at DESC LIMIT $2`,
    [subjectEntityId, limit]
  );
  return r.rows.map((row) => ({ claimId: row.claim_id, claimType: row.claim_type, title: row.title, creator: row.creator || "" }));
}

/**
 * Store one verified research finding: entity + claim (origin agent_research)
 * + T2 provenance. Unverified evidence is stored too (audit trail) but as
 * 'unverifiable'/'dead_link' — it earns nothing.
 */
export async function recordFinding({ subjectEntityId, finding, verification, runId }) {
  const workId = await upsertEntity({
    name: finding.targetTitle,
    kind: "work",
    domain: "other",
    metadata: { creator: finding.targetCreator },
  });
  if (!workId || workId === subjectEntityId) return null;

  const existing = await q(
    "SELECT id FROM claims WHERE ((subject_id = $1 AND object_id = $2) OR (subject_id = $2 AND object_id = $1)) AND claim_type = $3 LIMIT 1",
    [subjectEntityId, workId, finding.claimType]
  );
  let claimId = existing.rows[0]?.id;
  if (!claimId) {
    const r = await q(
      `INSERT INTO claims (subject_id, object_id, claim_type, slot_affinity, summary, origin, model_version, agent_run_id)
       VALUES ($1, $2, $3, '{}', $4, 'agent_research', $5, $6) RETURNING id`,
      [subjectEntityId, workId, finding.claimType, finding.note || null, process.env.KYNDA_MODEL_VERSION || "claude-fable-5", runId]
    );
    claimId = r.rows[0].id;
  }

  await addProvenance(claimId, {
    status: verification.status,
    method: "primary_source_quote_match",
    url: finding.sourceUrl,
    quote: finding.quote,
    speaker: finding.speaker || null,
    sourceDegree: ["first", "second", "third"].includes(finding.sourceDegree) ? finding.sourceDegree : null,
    publication: finding.publication || null,
    publishedDate: /^\d{4}(-\d{2}-\d{2})?$/.test(finding.publishedDate) ? (finding.publishedDate.length === 4 ? `${finding.publishedDate}-01-01` : finding.publishedDate) : null,
    archivedUrl: verification.archivedUrl || null,
    notes: verification.status === "quote_confirmed" ? finding.note || null : `evidence check failed: ${verification.reason || verification.detail || verification.status}`,
  });
  return { claimId, confirmed: verification.status === "quote_confirmed" };
}

/** Confirmed primary-source citations for a subject↔work pair (serve-time). */
export async function getCitationsForItem(subject, item) {
  if (!dbConfigured()) return [];
  const r = await q(
    `SELECT p.source_url, p.archived_url, p.quote, p.publication, p.published_date, p.speaker, p.source_degree
     FROM provenance p
     JOIN claims c ON c.id = p.claim_id
     JOIN entities s ON s.id IN (c.subject_id, c.object_id)
     JOIN entities o ON o.id IN (c.subject_id, c.object_id) AND o.id <> s.id
     WHERE p.verification_status = 'quote_confirmed'
       AND p.verification_method = 'primary_source_quote_match'
       AND (s.mbid = $1 OR s.wikidata_qid = $2 OR lower(s.name) = lower($3))
       AND lower(o.name) = lower($4)
     ORDER BY (CASE p.source_degree WHEN 'first' THEN 0 WHEN 'second' THEN 1 WHEN 'third' THEN 2 ELSE 1 END), p.created_at DESC
     LIMIT 3`,
    [subject.mbid || null, subject.wikidata_qid || null, subject.name, item.title]
  );
  return r.rows.map((row) => ({
    url: row.source_url,
    archivedUrl: row.archived_url,
    quote: row.quote,
    speaker: row.speaker || null,
    degree: row.source_degree || null,
    publication: row.publication || "source",
    date: row.published_date instanceof Date ? String(row.published_date.getUTCFullYear()) : row.published_date ? String(row.published_date).slice(0, 4) : null,
  }));
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
