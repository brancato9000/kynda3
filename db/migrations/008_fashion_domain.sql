-- V3-51: fashion becomes a first-class domain (Wave B brings Worth, Poiret,
-- Chanel-era designers — a category Skybetter won't expect a graph to have).

ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_domain_check;
ALTER TABLE entities ADD CONSTRAINT entities_domain_check
  CHECK (domain IN (
    'music', 'film', 'television', 'literature', 'art', 'design',
    'architecture', 'theater', 'dance', 'fashion', 'other'
  ));
