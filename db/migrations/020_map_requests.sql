-- Opening the site (Tony, 2026-10-03): no public action starts a paid map
-- build any more. Visitors ask for a map; requests collect here, ranked by
-- how many different visitors asked; Tony approves a batch and the batch
-- builder makes them.
--
-- key = the subject's Wikidata ID, else "mb:<MusicBrainz ID>", else
-- "name:<lowercased name>", so one subject collects one row however it
-- was reached (search or a stop on the map).
CREATE TABLE IF NOT EXISTS map_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  wikidata_qid       TEXT,
  mbid               UUID,
  description        TEXT,
  domain             TEXT,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  first_requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at         TIMESTAMPTZ
);

-- One vote per visitor per subject, so repeating a name doesn't move it up
-- the queue. requester is a salted hash of the connection, never the address.
CREATE TABLE IF NOT EXISTS map_request_votes (
  request_id UUID NOT NULL REFERENCES map_requests(id) ON DELETE CASCADE,
  requester  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, requester)
);

-- "Ask Kynda" costs a model call each; this log backs its site-wide daily cap.
CREATE TABLE IF NOT EXISTS ask_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_name TEXT,
  candidate    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ask_log_created_idx ON ask_log (created_at);

-- Searches that land on an already-mapped subject skip the model; they log
-- as 'mapped' so the daily search cap (which bounds model spend) ignores them.
ALTER TABLE query_log DROP CONSTRAINT IF EXISTS query_log_disambiguation_tier_check;
ALTER TABLE query_log ADD CONSTRAINT query_log_disambiguation_tier_check
  CHECK (disambiguation_tier IN ('certain', 'likely', 'ambiguous', 'mapped'));
