-- V3-26: Contributions — Lane 1 (evidence patching) pulled forward, plus
-- hallucination flags. No accounts yet: contributor is a free-form handle.
-- Evidence submissions pass the SAME deterministic gate as agent findings;
-- flags are review-queue items for humans.

CREATE TABLE IF NOT EXISTS contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('evidence', 'flag')),
  subject_name text NOT NULL,
  item_title text,
  item_creator text,
  slot_type text,
  claim_id uuid REFERENCES claims(id) ON DELETE SET NULL,
  url text,
  quote text,
  comment text,
  contributor text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected', 'resolved')),
  verification jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contributions_status_idx ON contributions (status, created_at);
