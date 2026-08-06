-- V3-69: hunches — ask-verdicts that graduate into submissions. A reader's
-- question ("was X influenced by Y?") can be proposed for the map WITHOUT
-- a source URL; the verdict's evidence suggestions ride along as the
-- curator's research trail. Lane 2's new_card keeps requiring a URL; a
-- hunch is the step before one exists.

ALTER TABLE contributions DROP CONSTRAINT IF EXISTS contributions_kind_check;
ALTER TABLE contributions ADD CONSTRAINT contributions_kind_check
  CHECK (kind IN ('evidence', 'flag', 'new_card', 'hunch'));
