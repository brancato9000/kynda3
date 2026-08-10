-- Media-correction lane (Tony's spec, 2026-08-10, from the Body-and-Soul
-- QA find): flagging media is NOT flagging prose — it needs its own kind,
-- structured specificity (wrong artist / wrong work / both), and an
-- optional link to the correct media (a different meaning than "Know a
-- source? Add it", which is about citations).
ALTER TABLE contributions DROP CONSTRAINT IF EXISTS contributions_kind_check;
ALTER TABLE contributions ADD CONSTRAINT contributions_kind_check
  CHECK (kind IN ('evidence', 'flag', 'new_card', 'hunch', 'media_flag'));
