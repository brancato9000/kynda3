-- V3-53: admin domain overrides. P106-derived domains are right at scale
-- but wrong at the margins — Wikidata gives Jesse Armstrong (Succession)
-- no television occupation, and Garry Marshall reads film-first to nobody.
-- A non-null domain_override pins the browsing domain: hygiene scripts
-- (classify-entities) must never write domain where it is set.

ALTER TABLE entities ADD COLUMN IF NOT EXISTS domain_override TEXT
  CHECK (domain_override IN (
    'music', 'film', 'television', 'literature', 'art', 'design',
    'architecture', 'theater', 'dance', 'fashion', 'other'
  ));
