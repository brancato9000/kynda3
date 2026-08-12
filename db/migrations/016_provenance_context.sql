-- Quote context (Tony, 2026-08-11): the wall locates every quote in its
-- source; the sentences AROUND the match are captured deterministically
-- (verbatim source text, dimmed in display — the certified quote stays
-- distinct). Backfilled by scripts/backfill-context.mjs.
ALTER TABLE provenance ADD COLUMN IF NOT EXISTS context_before TEXT;
ALTER TABLE provenance ADD COLUMN IF NOT EXISTS context_after TEXT;
