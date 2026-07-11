-- V3-32: Dance/choreography as a first-class domain (Brown/BAI collaboration
-- prep — and the purest showcase of the cross-medium thesis: Cunningham ↔
-- Cage ↔ Rauschenberg lives across dance, music, and visual art).

ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_domain_check;
ALTER TABLE entities ADD CONSTRAINT entities_domain_check
  CHECK (domain IN ('music', 'film', 'television', 'literature', 'art', 'design', 'architecture', 'theater', 'dance', 'other'));
