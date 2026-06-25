import { supabase } from '../lib/supabaseClient';
import { getLineups } from '../lib/apiFootball';

// Poll for confirmed lineups in the 90-minute window before kickoff.
// Once 11-man lineup is confirmed for both teams, stop re-fetching.
const WINDOW_MINUTES = 90;

export async function ingestLineups(): Promise<void> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + WINDOW_MINUTES * 60 * 1000);

  const { data: mappings, error } = await supabase
    .from('fixture_mapping')
    .select('odds_api_event_id, api_football_fixture_id')
    .gte('kickoff_at', now.toISOString())
    .lte('kickoff_at', windowEnd.toISOString())
    .not('api_football_fixture_id', 'is', null);

  if (error || !mappings?.length) return;

  for (const m of mappings) {
    // Skip if both lineups are already confirmed
    const { data: existing } = await supabase
      .from('lineups')
      .select('confirmed')
      .eq('fixture_id', m.odds_api_event_id)
      .eq('confirmed', true);

    if ((existing?.length ?? 0) >= 2) continue;

    const lineups = await getLineups(m.api_football_fixture_id as number);
    if (!lineups.length) continue;

    const confirmed = lineups.every(l => l.startingXI.length === 11);

    for (const lineup of lineups) {
      const { error: upsertErr } = await supabase.from('lineups').upsert(
        {
          fixture_id: m.odds_api_event_id,
          api_football_fixture_id: m.api_football_fixture_id,
          team_id: lineup.teamId,
          team_name: lineup.teamName,
          formation: lineup.formation,
          starting_xi: lineup.startingXI,
          substitutes: lineup.substitutes,
          confirmed,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'fixture_id,team_id' }
      );

      if (upsertErr) console.error('lineups upsert failed:', upsertErr.message);
    }
  }
}
