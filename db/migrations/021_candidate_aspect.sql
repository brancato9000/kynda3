-- Picture shape (2026-10-03): map bubbles are round, so a candidate's width:height decides
-- whether it can be applied on its own (≤1.6) and whether a work keeps looking for its poster.
ALTER TABLE image_candidates ADD COLUMN IF NOT EXISTS aspect real;
