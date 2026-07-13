-- V3-35: Lane 2 contributions — fans propose a whole new card by naming an
-- influence and handing us a URL that contains the evidence. Kynda does the
-- rest: free pre-gate, full harvest, machine quote-confirmation, then human
-- approval publishes the card.

ALTER TABLE contributions DROP CONSTRAINT IF EXISTS contributions_kind_check;
ALTER TABLE contributions ADD CONSTRAINT contributions_kind_check
  CHECK (kind IN ('evidence', 'flag', 'new_card'));
