import { supabase } from './supabase';

export async function fetchValueFeed() {
  const { data, error } = await supabase
    .from('computed_values')
    .select(`
      *,
      matches (
        id,
        kickoff_at,
        status,
        is_bet_of_day,
        home_team:teams!matches_home_team_id_fkey (id, name, short_name, crest_url),
        away_team:teams!matches_away_team_id_fkey (id, name, short_name, crest_url),
        league:leagues (id, name, country)
      )
    `)
    .order('mes_score', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

export async function fetchMatchOdds(matchId) {
  const { data, error } = await supabase
    .from('odds')
    .select('bookmaker, home_odds, draw_odds, away_odds, market_line, fetched_at')
    .eq('match_id', matchId)
    .eq('market', 'h2h')
    .order('fetched_at', { ascending: false });

  if (error) throw error;

  // Latest row per bookmaker
  const latest = {};
  for (const row of data || []) {
    if (!latest[row.bookmaker]) latest[row.bookmaker] = row;
  }
  return Object.values(latest);
}

export function formatEdge(edge) {
  if (edge == null) return null;
  const pct = (Math.abs(edge) * 100).toFixed(1);
  return `${edge > 0 ? '+' : '-'}${pct}%`;
}

export function edgeColor(edge) {
  if (edge == null) return 'text-ghost';
  if (edge >= 0.08) return 'text-signal';
  if (edge >= 0.03) return 'text-amber';
  if (edge > 0) return 'text-dim';
  return 'text-warn';
}
