import axios from 'axios';

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const BASE_URL = 'https://api.the-odds-api.com/v4';

// Maps internal league slugs to The Odds API sport keys
const LEAGUE_SPORT_KEYS: Record<string, string> = {
  fifa_world_cup_2026: 'soccer_fifa_world_cup',
  epl: 'soccer_epl',
  efl_championship: 'soccer_efl_champ',
};

export interface BookmakerOdds {
  key: string;
  home: number;
  draw: number;
  away: number;
}

export interface OddsApiFixture {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: Date;
  bookmakers: BookmakerOdds[];
}

export async function getOddsApiSnapshot(leagues: string[]): Promise<OddsApiFixture[]> {
  if (!ODDS_API_KEY) throw new Error('ODDS_API_KEY must be set');

  const sportKeys = leagues.map(l => {
    const key = LEAGUE_SPORT_KEYS[l];
    if (!key) throw new Error(`Unknown league: ${l}`);
    return key;
  });

  const responses = await Promise.all(
    sportKeys.map(sport =>
      axios.get(`${BASE_URL}/sports/${sport}/odds`, {
        params: {
          apiKey: ODDS_API_KEY,
          regions: 'uk',
          markets: 'h2h',
          oddsFormat: 'decimal',
        },
      })
    )
  );

  const fixtures: OddsApiFixture[] = [];

  for (const res of responses) {
    for (const event of res.data) {
      const bookmakers: BookmakerOdds[] = [];

      for (const bm of event.bookmakers ?? []) {
        const h2h = bm.markets?.find((m: { key: string }) => m.key === 'h2h');
        if (!h2h) continue;

        const outcomes: { name: string; price: number }[] = h2h.outcomes;
        const home = outcomes.find(o => o.name === event.home_team)?.price;
        const away = outcomes.find(o => o.name === event.away_team)?.price;
        const draw = outcomes.find(o => o.name === 'Draw')?.price;

        if (home && draw && away) {
          bookmakers.push({ key: bm.key, home, draw, away });
        }
      }

      if (bookmakers.length > 0) {
        fixtures.push({
          eventId: event.id,
          homeTeam: event.home_team,
          awayTeam: event.away_team,
          commenceTime: new Date(event.commence_time),
          bookmakers,
        });
      }
    }
  }

  return fixtures;
}

const TRACKED_BOOKS = ['bet365', 'williamhill', 'betfair_sb', 'paddypower', 'skybet'];

export function getBestRetailOdds(
  bookmakers: BookmakerOdds[]
): { home: number; draw: number; away: number } {
  const tracked = bookmakers.filter(b => TRACKED_BOOKS.includes(b.key));
  const pool = tracked.length > 0 ? tracked : bookmakers;

  return {
    home: Math.max(...pool.map(b => b.home)),
    draw: Math.max(...pool.map(b => b.draw)),
    away: Math.max(...pool.map(b => b.away)),
  };
}
