-- V3-34: Institutional/lineage claim types. Bio pages state roles, not
-- influences — "founded CRCI", "taught at Brown", "studied under Graham" —
-- and the vocabulary had no words for them. studied_under is dance lineage
-- itself: the art form transmits teacher-to-body.

ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_claim_type_check;
ALTER TABLE claims ADD CONSTRAINT claims_claim_type_check
  CHECK (claim_type IN (
    'influenced_by', 'cited_as_influence', 'covers', 'covered_by',
    'collaborated_with', 'member_of', 'produced_by', 'same_scene',
    'cross_medium_influence', 'used_gear', 'recorded_at',
    'founded', 'taught_at', 'studied_under'
  ));
