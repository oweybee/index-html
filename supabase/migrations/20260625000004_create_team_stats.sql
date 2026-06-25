-- Team stats from API-Football /teams/statistics endpoint.
-- One row per team per league per season; refreshed daily.

CREATE TABLE IF NOT EXISTS team_stats (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                 integer     NOT NULL,
  team_name               text        NOT NULL,
  league_id               integer     NOT NULL,
  season                  integer     NOT NULL,
  form                    text,
  clean_sheet_home        integer,
  clean_sheet_away        integer,
  clean_sheet_total       integer,
  failed_to_score_home    integer,
  failed_to_score_away    integer,
  failed_to_score_total   integer,
  avg_goals_for_home      numeric(4,2),
  avg_goals_for_away      numeric(4,2),
  avg_goals_against_home  numeric(4,2),
  avg_goals_against_away  numeric(4,2),
  fetched_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_team_stats UNIQUE (team_id, league_id, season)
);

CREATE INDEX IF NOT EXISTS idx_team_stats_team ON team_stats (team_id);
