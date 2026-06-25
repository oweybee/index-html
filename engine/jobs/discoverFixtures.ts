import { supabase } from '../lib/supabaseClient';
import { getOddsApiSnapshot } from '../lib/oddsApi';
import { getUpcomingFixtures, WORLD_CUP } from '../lib/apiFootball';

const TARGET_LEAGUES = ['fifa_world_cup_2026'];

// Normalise team names for fuzzy matching (remove accents, punctuation, case)
function norm(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function teamsMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

export async function discoverAndMapFixtures(): Promise<void> {
  const [oddsFixtures, afFixtures] = await Promise.all([
    getOddsApiSnapshot(TARGET_LEAGUES),
    getUpcomingFixtures(WORLD_CUP.leagueId, WORLD_CUP.season),
  ]);

  const rows = oddsFixtures.map(odds => {
    const match = afFixtures.find(af => {
      const kickoffDiff = Math.abs(
        af.kickoffAt.getTime() - odds.commenceTime.getTime()
      );
      return (
        teamsMatch(odds.homeTeam, af.homeTeam.name) &&
        teamsMatch(odds.awayTeam, af.awayTeam.name) &&
        kickoffDiff < 2 * 60 * 60 * 1000 // within 2h
      );
    });

    return {
      odds_api_event_id: odds.eventId,
      api_football_fixture_id: match?.fixtureId ?? null,
      home_team: odds.homeTeam,
      away_team: odds.awayTeam,
      kickoff_at: odds.commenceTime.toISOString(),
    };
  });

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('fixture_mapping')
    .upsert(rows, { onConflict: 'odds_api_event_id' });

  if (error) console.error('fixture_mapping upsert failed:', error.message);
  else console.log(`Mapped ${rows.length} fixtures (${rows.filter(r => r.api_football_fixture_id).length} resolved to API-Football IDs)`);
}
