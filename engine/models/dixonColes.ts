import { supabase } from '../lib/supabaseClient';

export interface DCProbabilities {
  home: number;
  draw: number;
  away: number;
}

/**
 * Fetches the most recent Dixon-Coles 1X2 probabilities from the db.
 * The Dixon-Coles fitting job writes rows to `dc_probabilities` on its
 * own schedule; this function is read-only.
 */
export async function getDixonColesProbabilities(
  homeTeam: string,
  awayTeam: string
): Promise<DCProbabilities | null> {
  const { data, error } = await supabase
    .from('dc_probabilities')
    .select('prob_home, prob_draw, prob_away')
    .eq('home_team', homeTeam)
    .eq('away_team', awayTeam)
    .order('computed_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    home: data.prob_home,
    draw: data.prob_draw,
    away: data.prob_away,
  };
}
