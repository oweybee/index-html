-- Edge signals: one row per (fixture, outcome) updated each compute cycle.
-- tier is NULL for no-edge rows; filter to IS NOT NULL on the frontend.

CREATE TABLE IF NOT EXISTS edge_signals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id      text        NOT NULL,
  outcome         text        NOT NULL CHECK (outcome IN ('home', 'draw', 'away')),
  fair_prob_betfair numeric(6,4) NOT NULL,
  fair_prob_dc    numeric(6,4) NOT NULL,
  edge_betfair    numeric(6,4) NOT NULL,
  edge_dc         numeric(6,4) NOT NULL,
  signals_agree   boolean     NOT NULL DEFAULT false,
  tier            text        CHECK (tier IN ('RUBY', 'VALUE')),
  computed_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_edge_signals_fixture_outcome UNIQUE (fixture_id, outcome)
);

CREATE INDEX IF NOT EXISTS idx_edge_signals_tier
  ON edge_signals (tier)
  WHERE tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_edge_signals_computed_at
  ON edge_signals (computed_at DESC);
