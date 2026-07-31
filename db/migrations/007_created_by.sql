-- V3-49: creatorship as a first-class claim. A work's creator has lived in
-- metadata.creator as a string — invisible to the graph, pathfinding, and
-- aggregation. created_by(work, person) makes artist↔work navigable:
-- influence attaches to the most specific documented locus; creatorship
-- edges make the loci navigable; aggregation is a view, never a claim.

ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_claim_type_check;
ALTER TABLE claims ADD CONSTRAINT claims_claim_type_check
  CHECK (claim_type IN (
    'influenced_by', 'cited_as_influence', 'covers', 'covered_by',
    'collaborated_with', 'member_of', 'produced_by', 'same_scene',
    'cross_medium_influence', 'used_gear', 'recorded_at',
    'founded', 'taught_at', 'studied_under', 'created_by'
  ));
