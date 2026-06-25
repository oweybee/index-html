-- Add LONGSHOT to the tier check constraint on edge_signals.
-- Outcomes with p_fair_kaunitz < 1/3 and no positive edge are classified LONGSHOT.

ALTER TABLE edge_signals
  DROP CONSTRAINT IF EXISTS edge_signals_tier_check;

ALTER TABLE edge_signals
  ADD CONSTRAINT edge_signals_tier_check
    CHECK (tier IN ('RUBY', 'VALUE', 'LONGSHOT'));
