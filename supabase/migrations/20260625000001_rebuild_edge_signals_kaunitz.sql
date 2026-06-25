-- Rebuild edge_signals with Kaunitz consensus model columns.
-- Replaces Dixon-Coles dependency (fair_prob_dc / edge_dc) with
-- consensus probability and bias-corrected Kaunitz fair probability.
-- Safe to drop-recreate: table was empty at this point in development.

DROP TABLE IF EXISTS edge_signals;

CREATE TABLE edge_signals (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id      text         NOT NULL,
  outcome         text         NOT NULL CHECK (outcome IN ('home', 'draw', 'away')),

  -- Kaunitz consensus probability: 1/mean(all bookmaker odds)
  p_cons          numeric(6,4) NOT NULL,
  -- Bias-corrected fair probability: p_cons - α (α per Kaunitz et al. 2017)
  p_fair_kaunitz  numeric(6,4) NOT NULL,
  -- Betfair Exchange devigged probability (optional — null when market not yet open)
  p_fair_betfair  numeric(6,4),

  -- Expected payoff: p_fair × max_retail_odds - 1
  edge_kaunitz    numeric(6,4) NOT NULL,
  -- Betfair edge: p_fair_betfair - implied_retail (optional)
  edge_betfair    numeric(6,4),

  bookmaker_count smallint     NOT NULL,
  signals_agree   boolean      NOT NULL DEFAULT false,
  tier            text         CHECK (tier IN ('RUBY', 'VALUE')),
  computed_at     timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT uq_edge_signals_fixture_outcome UNIQUE (fixture_id, outcome)
);

CREATE INDEX IF NOT EXISTS idx_edge_signals_tier
  ON edge_signals (tier) WHERE tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_edge_signals_computed_at
  ON edge_signals (computed_at DESC);
