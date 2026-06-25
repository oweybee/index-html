-- Maps OddsAPI event IDs to API-Football fixture IDs.
-- Populated by discoverAndMapFixtures() job (runs every 30 min).

CREATE TABLE IF NOT EXISTS fixture_mapping (
  odds_api_event_id         text        PRIMARY KEY,
  api_football_fixture_id   integer,
  home_team                 text        NOT NULL,
  away_team                 text        NOT NULL,
  kickoff_at                timestamptz NOT NULL,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fixture_mapping_kickoff
  ON fixture_mapping (kickoff_at);

CREATE INDEX IF NOT EXISTS idx_fixture_mapping_afid
  ON fixture_mapping (api_football_fixture_id)
  WHERE api_football_fixture_id IS NOT NULL;
