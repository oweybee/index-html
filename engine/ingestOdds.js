import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ODDS_API_KEY = process.env.ODDS_API_KEY;

const SPORTS = [
  'soccer_fifa_world_cup',
  'soccer_conmebol_copa_libertadores',
  'soccer_norway_eliteserien',
  'soccer_sweden_allsvenskan',
  'soccer_brazil_serie_b',
];

const LEAGUE_NAMES = {
  soccer_fifa_world_cup: 'FIFA World Cup',
  soccer_conmebol_copa_libertadores: 'Copa Libertadores',
  soccer_norway_eliteserien: 'Eliteserien',
  soccer_sweden_allsvenskan: 'Allsvenskan',
  soccer_brazil_serie_b: 'Brazil Serie B',
};

const SOFT_BOOKS = [
  'bet365', 'skybet', 'williamhill', 'paddypower', 'coral',
  'ladbrokes_uk', 'betfred_uk', 'betway', 'betvictor', 'boylesports',
  'betfair_sb_uk', 'unibet_uk', 'virginbet', 'sport888',
];

const SHARP_BOOKS = ['betfair_ex_uk', 'smarkets', 'matchbook'];

const ALL_BOOKS = [...SOFT_BOOKS, ...SHARP_BOOKS].join(',');

async function fetchOddsForSport(sport) {
  const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/`
    + `?apiKey=${ODDS_API_KEY}&regions=uk&markets=h2h,totals`
    + `&oddsFormat=decimal&bookmakers=${ALL_BOOKS}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Odds API ${res.status}: ${text}`);
  }
  return res.json();
}

const teamIdCache = {};
const leagueEnsured = new Set();

async function ensureLeague(sport) {
  if (leagueEnsured.has(sport)) return;
  const { error } = await supabase
    .from('leagues')
    .upsert(
      { id: sport, name: LEAGUE_NAMES[sport] || sport, country: 'International' },
      { onConflict: 'id', ignoreDuplicates: true }
    );
  if (error) console.warn('League upsert:', error.message);
  leagueEnsured.add(sport);
}

async function ensureTeam(name) {
  if (teamIdCache[name]) return teamIdCache[name];
  const { data: existing } = await supabase
    .from('teams')
    .select('id')
    .eq('name', name)
    .maybeSingle();
  if (existing) {
    teamIdCache[name] = existing.id;
    return existing.id;
  }
  const { data: inserted, error } = await supabase
    .from('teams')
    .insert({ name, short_name: name.substring(0, 12) })
    .select('id')
    .single();
  if (error) throw new Error(`Team insert failed for "${name}": ${error.message}`);
  teamIdCache[name] = inserted.id;
  return inserted.id;
}

async function ensureMatch(event, sport) {
  const homeTeamId = await ensureTeam(event.home_team);
  const awayTeamId = await ensureTeam(event.away_team);

  const { data, error } = await supabase
    .from('matches')
    .upsert(
      {
        external_id: event.id,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        league_id: sport,
        kickoff_at: event.commence_time,
        status: 'scheduled',
      },
      { onConflict: 'external_id' }
    )
    .select('id')
    .single();

  if (error) throw new Error(`Match upsert failed: ${error.message}`);
  return data.id;
}

async function ingestEvent(event, sport) {
  const matchId = await ensureMatch(event, sport);
  const rows = [];
  const now = new Date().toISOString();

  for (const bookmaker of event.bookmakers) {
    const h2h = bookmaker.markets?.find(m => m.key === 'h2h');
    if (h2h) {
      const home = h2h.outcomes.find(o => o.name === event.home_team);
      const away = h2h.outcomes.find(o => o.name === event.away_team);
      const draw = h2h.outcomes.find(o => o.name === 'Draw');
      if (home && away) {
        rows.push({
          match_id: matchId,
          bookmaker: bookmaker.key,
          market: 'h2h',
          home_odds: home.price,
          draw_odds: draw?.price ?? null,
          away_odds: away.price,
          market_line: null,
          fetched_at: now,
        });
      }
    }

    const totals = bookmaker.markets?.find(m => m.key === 'totals');
    if (totals) {
      const over = totals.outcomes.find(o => o.name === 'Over');
      const under = totals.outcomes.find(o => o.name === 'Under');
      if (over && under) {
        rows.push({
          match_id: matchId,
          bookmaker: bookmaker.key,
          market: 'totals',
          home_odds: over.price,
          draw_odds: null,
          away_odds: under.price,
          market_line: over.point ?? 2.5,
          fetched_at: now,
        });
      }
    }
  }

  if (rows.length === 0) return;

  const { error } = await supabase.from('odds').insert(rows);
  if (error) console.error(`  Odds insert error for ${event.home_team} vs ${event.away_team}:`, error.message);
  else console.log(`  ✓ ${event.home_team} vs ${event.away_team} — ${rows.length} rows`);
}

async function main() {
  console.log('Starting odds ingestion…');
  for (const sport of SPORTS) {
    try {
      await ensureLeague(sport);
      console.log(`\nFetching ${LEAGUE_NAMES[sport]}…`);
      const events = await fetchOddsForSport(sport);
      console.log(`  ${events.length} events`);
      for (const event of events) {
        await ingestEvent(event, sport);
      }
    } catch (e) {
      console.error(`Error for ${sport}:`, e.message);
    }
  }
  console.log('\nDone.');
}

main().catch(console.error);
