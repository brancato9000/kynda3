-- Visitor map requests (Tony, 2026-10-03): the "Ask Kynda to map this"
-- button on an unmapped stop (V3-88) adds to the research queue; its
-- requests must be distinguishable from Tony's own manual entries.
ALTER TABLE research_queue DROP CONSTRAINT IF EXISTS research_queue_enqueued_by_check;
ALTER TABLE research_queue ADD CONSTRAINT research_queue_enqueued_by_check
  CHECK (enqueued_by IN ('launch_list', 'query_log', 'manual', 'visitor'));
