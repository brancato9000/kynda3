-- V3-21: Source degrees & speaker attribution.
--
-- Degree attaches to the SPEAKER, not the publication: a Scorsese quote in a
-- Film Comment interview is first-degree voice in a second-degree venue.
--   first  — the subject/its creators/direct collaborators speaking
--   second — named critics, journalists, scholars making the connection
--   third  — fan analysis, wikis, crowd sources (also where fan submissions enter)
-- Quote verification stays deterministic and degree-blind; speaker/degree are
-- classification metadata (agent-proposed, curator-correctable).

ALTER TABLE provenance
  ADD COLUMN IF NOT EXISTS speaker text,
  ADD COLUMN IF NOT EXISTS source_degree text
    CHECK (source_degree IS NULL OR source_degree IN ('first', 'second', 'third'));
