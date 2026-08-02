-- V3-56: concept subjects. Skybetter's "live art in microgravity" is a
-- practice, not an entity — no QID, no catalog row, correctly unmatched by
-- retrieval. But a practice has an influence map too. 'concept' makes the
-- hub first-class: curated into existence (never invented by retrieval),
-- mixed and verified like any subject, honest UNCHECKED where no catalog
-- can speak.

ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_kind_check;
ALTER TABLE entities ADD CONSTRAINT entities_kind_check
  CHECK (kind IN (
    'person', 'group', 'work', 'release', 'recording',
    'film', 'tv_show', 'book', 'place', 'concept', 'other'
  ));
