import { supabase } from '../lib/supabaseClient';
import { getPredictions } from '../lib/apiFootball';

// Fetch predictions once per fixture — API-Football charges per call.
// Re-runs are skipped unless the fixture has no prediction yet.
export async function ingestPredictions(): Promise<void> {
  const now = new Date().toISOString();

  const { data: mappings, error } = await supabase
    .from('fixture_mapping')
    .select('odds_api_event_id, api_football_fixture_id')
    .gt('kickoff_at', now)
    .not('api_football_fixture_id', 'is', null);

  if (error || !mappings?.length) return;

  const { data: existing } = await supabase
    .from('match_predictions')
    .select('fixture_id')
    .in('fixture_id', mappings.map(m => m.odds_api_event_id));

  const done = new Set((existing ?? []).map(e => e.fixture_id));
  const toFetch = mappings.filter(m => !done.has(m.odds_api_event_id));

  for (const m of toFetch) {
    const pred = await getPredictions(m.api_football_fixture_id as number);
    if (!pred) continue;

    const { error: upsertErr } = await supabase.from('match_predictions').upsert(
      {
        fixture_id: m.odds_api_event_id,
        api_football_fixture_id: m.api_football_fixture_id,
        winner_team: pred.winnerTeam,
        winner_comment: pred.winnerComment,
        under_over: pred.underOver,
        goals_home: pred.goalsHome,
        goals_away: pred.goalsAway,
        advice: pred.advice,
        pct_home: pred.pctHome,
        pct_draw: pred.pctDraw,
        pct_away: pred.pctAway,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'fixture_id' }
    );

    if (upsertErr) console.error('match_predictions upsert failed:', upsertErr.message);
  }
}
