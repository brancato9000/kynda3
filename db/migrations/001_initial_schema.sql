-- Kynda v3 — initial schema
-- The provenance model in SQL. Core invariant: claim confidence is DERIVED
-- from verification records (see claim_state view at the bottom), never
-- stored as a model's self-assessment.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── ENTITIES ────────────────────────────────────────────────────────────
-- Canonical cultural entities. Anything without at least one resolvable
-- external ID is either unresolved (external IDs all NULL, flagged by the
-- app) or should not be served as "verified" anything.

CREATE TABLE entities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             TEXT NOT NULL CHECK (kind IN
                     ('person','group','work','release','recording',
                      'film','tv_show','book','place','other')),
  domain           TEXT NOT NULL CHECK (domain IN
                     ('music','film','television','literature','art',
                      'design','architecture','theater','other')),
  name             TEXT NOT NULL,
  sort_name        TEXT,
  year_start       SMALLINT,          -- debut / release / birth year
  year_end         SMALLINT,          -- dissolution / death year, NULL if ongoing
  -- Canonical external IDs. Partial unique indexes below prevent duplicates.
  mbid             UUID,              -- MusicBrainz (artist or release-group)
  tmdb_id          INTEGER,           -- The Movie Database
  openlibrary_id   TEXT,              -- Open Library
  wikidata_qid     TEXT,              -- Wikidata (cross-domain spine)
  wikipedia_title  TEXT,              -- for images / extracts
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX entities_mbid_uniq     ON entities (mbid)         WHERE mbid IS NOT NULL;
CREATE UNIQUE INDEX entities_tmdb_uniq     ON entities (tmdb_id, kind) WHERE tmdb_id IS NOT NULL;
CREATE UNIQUE INDEX entities_wikidata_uniq ON entities (wikidata_qid) WHERE wikidata_qid IS NOT NULL;
CREATE INDEX entities_name_idx ON entities (lower(name));

-- ─── CLAIMS ──────────────────────────────────────────────────────────────
-- Typed, directional edges between entities: subject → object.
-- "Radiohead influenced_by Pixies" has subject=Radiohead, object=Pixies.
-- Legacy/successor relationships are the inverse read of influenced_by;
-- they are not a separate type.

CREATE TABLE claims (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id     UUID NOT NULL REFERENCES entities(id),
  object_id      UUID NOT NULL REFERENCES entities(id),
  claim_type     TEXT NOT NULL CHECK (claim_type IN
                   ('influenced_by',         -- subject was influenced by object
                    'cited_as_influence',    -- subject explicitly cited object (stronger than influenced_by)
                    'covers',                -- subject performs object's work
                    'covered_by',            -- object performs subject's work
                    'collaborated_with',
                    'member_of',
                    'produced_by',
                    'same_scene',            -- shared geography / scene / era
                    'cross_medium_influence',-- influence across domains
                    'used_gear',             -- object is an instrument/tool entity
                    'recorded_at')),         -- object is a place entity
  -- Which KyndaMix slots this claim can serve (titan, ghost, geography,
  -- culture, peer, essential, legacy, collaborator). Validated app-side.
  slot_affinity  TEXT[] NOT NULL DEFAULT '{}',
  summary        TEXT,                       -- short neutral statement of the claim
  origin         TEXT NOT NULL CHECK (origin IN
                   ('structured_db',         -- imported from MusicBrainz/Wikidata relationship data
                    'agent_research',        -- offline research pipeline
                    'runtime_generation',    -- runtime gap path
                    'human_curation')),
  model_version  TEXT,                       -- which model produced it, if any
  agent_run_id   TEXT,                       -- offline pipeline run identifier
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (subject_id <> object_id)            -- AD-10: no self-reference, enforced in the database
);

CREATE INDEX claims_subject_idx ON claims (subject_id, claim_type);
CREATE INDEX claims_object_idx  ON claims (object_id, claim_type);

-- ─── PROVENANCE ──────────────────────────────────────────────────────────
-- Evidence records attached to claims. A claim may have several.
-- verification_status is written ONLY by the deterministic verifier
-- (fetch → archive → string-match) or by DB relationship import. Models
-- and agents may INSERT rows as 'pending'; they never set a confirmed status.

CREATE TABLE provenance (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id             UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  source_url           TEXT,
  archived_url         TEXT,               -- archive.org snapshot taken at ingest
  quote                TEXT,               -- exact excerpt claimed to appear at source_url
  publication          TEXT,               -- e.g. "Melody Maker", "Rolling Stone"
  published_date       DATE,
  retrieved_at         TIMESTAMPTZ,
  verification_status  TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN
                         ('pending',          -- agent-submitted, not yet checked
                          'quote_confirmed',  -- quote string-matched on fetched page → strongest
                          'db_relationship',  -- backed by a structured-DB relationship record
                          'url_live',         -- URL resolves but quote not confirmable (e.g. paywall)
                          'unverifiable',     -- fetched, quote not found
                          'dead_link')),      -- URL gone and no archive snapshot
  verification_method  TEXT,               -- 'string_match' | 'db_import' | 'manual'
  verified_at          TIMESTAMPTZ,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX provenance_claim_idx ON provenance (claim_id, verification_status);

-- ─── REVIEWS ─────────────────────────────────────────────────────────────
-- Human curation layer (evolves kynda2's curated/ directory). Approved
-- reviews raise a claim to verified; rejected reviews suppress it entirely.
-- perspective supports the Phase 4-6 multi-perspective vision.

CREATE TABLE reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id        UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  status          TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','edited')),
  perspective     TEXT NOT NULL DEFAULT 'editorial' CHECK (perspective IN
                    ('editorial','artist','critic','fan')),
  reviewer        TEXT NOT NULL,             -- attribution, always
  edited_summary  TEXT,                      -- replacement summary when status = 'edited'
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reviews_claim_idx ON reviews (claim_id, status);

-- ─── RESEARCH QUEUE ──────────────────────────────────────────────────────
-- Subjects awaiting offline agent research, popularity-ordered (Zipf).

CREATE TABLE research_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    UUID NOT NULL REFERENCES entities(id),
  priority     INTEGER NOT NULL DEFAULT 0,   -- higher = sooner
  status       TEXT NOT NULL DEFAULT 'queued' CHECK (status IN
                 ('queued','running','done','failed')),
  enqueued_by  TEXT NOT NULL CHECK (enqueued_by IN
                 ('launch_list','query_log','manual')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX research_queue_entity_uniq ON research_queue (entity_id);
CREATE INDEX research_queue_pick_idx ON research_queue (status, priority DESC);

-- ─── QUERY LOG ───────────────────────────────────────────────────────────
-- Raw searches → resolved entities. Feeds research-queue prioritization.

CREATE TABLE query_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_query           TEXT NOT NULL,
  resolved_entity_id  UUID REFERENCES entities(id),
  disambiguation_tier TEXT CHECK (disambiguation_tier IN ('certain','likely','ambiguous')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX query_log_entity_idx ON query_log (resolved_entity_id, created_at);

-- ─── MIXES ───────────────────────────────────────────────────────────────
-- Assembled KyndaMix payloads, cached per subject entity (replaces kynda2's
-- string-keyed in-memory cache). source records how it was built.

CREATE TABLE mixes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_entity_id  UUID NOT NULL REFERENCES entities(id),
  payload            JSONB NOT NULL,
  source             TEXT NOT NULL CHECK (source IN ('corpus','generated','hybrid')),
  model_version      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mixes_subject_idx ON mixes (subject_entity_id, created_at DESC);

-- ─── CLAIM STATE VIEW ────────────────────────────────────────────────────
-- THE core invariant, encoded in the database: effective confidence is
-- derived from provenance and review state. Nothing else in the system is
-- allowed to decide what "verified" means.
--
--   verified : human-approved, OR quote-confirmed source, OR structured-DB relationship
--   sourced  : cited source whose URL is live but quote unconfirmed (e.g. paywall)
--   inferred : everything else — model reasoning without checkable evidence
--
-- suppressed = true when a human rejected the claim; the app must never serve it.

CREATE VIEW claim_state AS
SELECT
  c.id AS claim_id,
  EXISTS (SELECT 1 FROM reviews r
          WHERE r.claim_id = c.id AND r.status = 'rejected') AS suppressed,
  CASE
    WHEN EXISTS (SELECT 1 FROM reviews r
                 WHERE r.claim_id = c.id AND r.status IN ('approved','edited'))
      THEN 'verified'
    WHEN EXISTS (SELECT 1 FROM provenance p
                 WHERE p.claim_id = c.id
                   AND p.verification_status IN ('quote_confirmed','db_relationship'))
      THEN 'verified'
    WHEN EXISTS (SELECT 1 FROM provenance p
                 WHERE p.claim_id = c.id AND p.verification_status = 'url_live')
      THEN 'sourced'
    ELSE 'inferred'
  END AS confidence
FROM claims c;
