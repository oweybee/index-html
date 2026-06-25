-- Match predictions from API-Football /predictions endpoint.
-- Fetched once per fixture pre-kickoff; not re-fetched unless missing.

CREATE TABLE IF NOT EXISTS match_predictions (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id                text        NOT NULL UNIQUE,
  api_football_fixture_id   integer,
  winner_team               text,
  winner_comment            text,
  under_over                text,
  goals_home                text,
  goals_away                text,
  advice                    text,
  pct_home                  text,
  pct_draw                  text,
  pct_away                  text,
  fetched_at                timestamptz NOT NULL DEFAULT now()
);
