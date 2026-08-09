-- Comedy becomes a first-class domain (Tony's category call, 2026-08-08:
-- "comedy deserves its own category on the homepage" — 10-comedian wave
-- seeded same day; Richard Pryor comes home from television).
-- Same drop-and-recreate pattern as 004 (dance) and 008 (fashion).
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_domain_check;
ALTER TABLE entities ADD CONSTRAINT entities_domain_check
  CHECK (domain IN ('music', 'film', 'television', 'literature', 'art', 'design', 'architecture', 'theater', 'dance', 'fashion', 'comedy', 'other'));
