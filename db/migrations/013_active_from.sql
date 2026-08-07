-- V3-70 follow-up (Tony's correction): influence-over-time uses the FIRST
-- YEAR OF THE ACTIVE RANGE as the signal date — birth vs formation mixes
-- bases and smears people ~20 years early. active_from holds career start
-- (Wikidata P2031 for people; formation year for groups); year_start stays
-- biographical. No fallback from career to birth — undated is undated.
ALTER TABLE entities ADD COLUMN IF NOT EXISTS active_from SMALLINT;
