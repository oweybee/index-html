import { supabase } from '../lib/supabaseClient';
import { getUpcomingFixtures, getTeamStats, WORLD_CUP } from '../lib/apiFootball';

// Runs daily. Fetches stats for every team with an upcoming fixture.
// Uses UPSERT so stale rows get refreshed each time.
export async function ingestTeamStats(): Promise<void> {
  const fixtures = await getUpcomingFixtures(WORLD_CUP.leagueId, WORLD_CUP.season);

  const teamIds = new Set<number>();
  for (const f of fixtures) {
    teamIds.add(f.homeTeam.id);
    teamIds.add(f.awayTeam.id);
  }

  for (const teamId of teamIds) {
    const stats = await getTeamStats(WORLD_CUP.leagueId, WORLD_CUP.season, teamId);
    if (!stats) continue;

    const { error } = await supabase.from('team_stats').upsert(
      {
        team_id: stats.teamId,
        team_name: stats.teamName,
        league_id: WORLD_CUP.leagueId,
        season: WORLD_CUP.season,
        form: stats.form,
        clean_sheet_home: stats.cleanSheetHome,
        clean_sheet_away: stats.cleanSheetAway,
        clean_sheet_total: stats.cleanSheetTotal,
        failed_to_score_home: stats.failedToScoreHome,
        failed_to_score_away: stats.failedToScoreAway,
        failed_to_score_total: stats.failedToScoreTotal,
        avg_goals_for_home: stats.avgGoalsForHome,
        avg_goals_for_away: stats.avgGoalsForAway,
        avg_goals_against_home: stats.avgGoalsAgainstHome,
        avg_goals_against_away: stats.avgGoalsAgainstAway,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'team_id,league_id,season' }
    );

    if (error) console.error(`team_stats upsert failed for team ${teamId}:`, error.message);
  }
}
