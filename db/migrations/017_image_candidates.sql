-- Map images (2026-10-02): every person, work and institution on the
-- influence map gets a rights-cleared picture or none. Applied images live
-- on the entity (metadata.image_url / image_page / image_license /
-- image_credit / image_source / image_status), the same fields mix cards
-- already hydrate from. Anything the backfill can't apply on its own lands
-- here as candidates for the curator queue in /admin/images.
CREATE TABLE IF NOT EXISTS image_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  source text NOT NULL,          -- wikidata | enwiki | commons | openverse | loc | coverart
  url text NOT NULL,             -- display image (thumbnail-sized)
  page text,                     -- where a curator verifies it
  license text,
  credit text,
  title text,                    -- the candidate's own label (article title, file name)
  description text,              -- what the source says it is — the namesake check
  fair_use boolean NOT NULL DEFAULT false,
  score real NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, url)
);
CREATE INDEX IF NOT EXISTS image_candidates_pending_idx ON image_candidates (status, entity_id);
