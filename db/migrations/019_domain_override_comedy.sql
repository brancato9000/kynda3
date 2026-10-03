-- Comedy became a field in 014, but the admin override's allowed list was
-- never widened, so pinning a comedian's field failed (2026-10-03, when the
-- build's roster fields were pinned — Chris Rock, Bob Hope, Redd Foxx).
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_domain_override_check;
ALTER TABLE entities ADD CONSTRAINT entities_domain_override_check
  CHECK (domain_override IN ('music', 'film', 'television', 'literature', 'art', 'design', 'architecture', 'theater', 'dance', 'fashion', 'comedy', 'other'));
