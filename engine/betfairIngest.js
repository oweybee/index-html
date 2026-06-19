import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APP_KEY = process.env.BETFAIR_APP_KEY;
const USERNAME = process.env.BETFAIR_USERNAME;
const PASSWORD = process.env.BETFAIR_PASSWORD;

let sessionToken = null;

async function login() {
  const res = await fetch('https://identitysso.betfair.com/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Application': APP_KEY,
      Accept: 'application/json',
    },
    body: `username=${encodeURIComponent(USERNAME)}&password=${encodeURIComponent(PASSWORD)}`,
  });
  const data = await res.json();
  if (data.status !== 'SUCCESS') throw new Error(`Betfair login failed: ${data.error}`);
  sessionToken = data.token;
  console.log('Betfair login OK');
}

async function apiCall(method, params) {
  const res = await fetch('https://api.betfair.com/exchange/betting/json-rpc/v1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Application': APP_KEY,
      'X-Authentication': sessionToken,
    },
    body: JSON.stringify([{
      jsonrpc: '2.0',
      method: `SportsAPING/v1.0/${method}`,
      params,
      id: 1,
    }]),
  });
  const body = await res.json();
  if (body[0]?.error) throw new Error(JSON.stringify(body[0].error));
  return body[0]?.result;
}

async function listUpcomingMarkets() {
  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 86400000);

  const events = await apiCall('listEvents', {
    filter: {
      eventTypeIds: ['1'],
      marketStartTime: { from: now.toISOString(), to: weekOut.toISOString() },
    },
  });
  if (!events?.length) return [];

  const eventIds = events.map(e => e.event.id);
  const markets = await apiCall('listMarketCatalogue', {
    filter: { eventTypeIds: ['1'], eventIds, marketTypeCodes: ['MATCH_ODDS', 'OVER_UNDER_25'] },
    marketProjection: ['MARKET_NAME', 'EVENT', 'RUNNERS', 'RUNNER_DESCRIPTION'],
    maxResults: 200,
  });
  return markets || [];
}

async function getMarketBooks(marketIds) {
  const books = {};
  const BATCH = 40;
  for (let i = 0; i < marketIds.length; i += BATCH) {
    const slice = marketIds.slice(i, i + BATCH);
    const result = await apiCall('listMarketBook', {
      marketIds: slice,
      priceProjection: {
        priceData: ['EX_BEST_OFFERS'],
        exBestOffersOverrides: { rollupModel: 'STAKE', rollupLimit: 20 },
      },
    });
    for (const b of result || []) books[b.marketId] = b;
  }
  return books;
}

function bestBackPrice(runners, selectionId) {
  const runner = runners?.find(r => r.selectionId === selectionId);
  return runner?.ex?.availableToBack?.[0]?.price ?? null;
}

// Build an index from Supabase: "HomeTeam|AwayTeam" => matchId
async function buildMatchIndex() {
  const { data } = await supabase
    .from('matches')
    .select(`
      id,
      home_team:teams!matches_home_team_id_fkey (name),
      away_team:teams!matches_away_team_id_fkey (name)
    `)
    .eq('status', 'scheduled');

  const index = {};
  for (const m of data || []) {
    const key = `${m.home_team?.name}|${m.away_team?.name}`;
    index[key] = m.id;
  }
  return index;
}

async function ingestMarket(market, book, matchId) {
  const now = new Date().toISOString();
  const rows = [];

  const eventName = market.event?.name || '';
  const parts = eventName.split(' v ');
  const homeTeamName = parts[0]?.trim();
  const awayTeamName = parts[1]?.trim();

  if (market.marketName === 'Match Odds') {
    // Map runners by name — NOT by array position
    const homeRunner = market.runners?.find(r => r.runnerName === homeTeamName);
    const drawRunner = market.runners?.find(r => r.runnerName === 'The Draw');
    const awayRunner = market.runners?.find(r => r.runnerName === awayTeamName);

    if (!homeRunner || !awayRunner) {
      console.warn(`  Runner name mismatch for "${eventName}" — skipping Match Odds`);
      return;
    }

    const homeOdds = bestBackPrice(book.runners, homeRunner.selectionId);
    const drawOdds = drawRunner ? bestBackPrice(book.runners, drawRunner.selectionId) : null;
    const awayOdds = bestBackPrice(book.runners, awayRunner.selectionId);

    if (homeOdds && awayOdds) {
      rows.push({
        match_id: matchId,
        bookmaker: 'betfair_ex_uk',
        market: 'h2h',
        home_odds: homeOdds,
        draw_odds: drawOdds,
        away_odds: awayOdds,
        market_line: null,
        fetched_at: now,
      });
    }
  } else if (market.marketName?.includes('Over/Under 2.5')) {
    const overRunner = market.runners?.find(r => r.runnerName?.toLowerCase().includes('over'));
    const underRunner = market.runners?.find(r => r.runnerName?.toLowerCase().includes('under'));

    if (overRunner && underRunner) {
      const overOdds = bestBackPrice(book.runners, overRunner.selectionId);
      const underOdds = bestBackPrice(book.runners, underRunner.selectionId);
      if (overOdds && underOdds) {
        rows.push({
          match_id: matchId,
          bookmaker: 'betfair_ex_uk',
          market: 'totals',
          home_odds: overOdds,
          draw_odds: null,
          away_odds: underOdds,
          market_line: 2.5,
          fetched_at: now,
        });
      }
    }
  }

  if (rows.length) {
    const { error } = await supabase.from('odds').insert(rows);
    if (error) console.error('  Insert error:', error.message);
    else console.log(`  ✓ ${eventName} — ${rows.length} row(s)`);
  }
}

async function main() {
  console.log('Starting Betfair ingestion…');
  await login();

  const markets = await listUpcomingMarkets();
  console.log(`Found ${markets.length} markets`);
  if (!markets.length) return;

  const matchIndex = await buildMatchIndex();
  const books = await getMarketBooks(markets.map(m => m.marketId));

  for (const market of markets) {
    const eventName = market.event?.name || '';
    const parts = eventName.split(' v ');
    const home = parts[0]?.trim();
    const away = parts[1]?.trim();
    if (!home || !away) continue;

    const matchId = matchIndex[`${home}|${away}`];
    if (!matchId) {
      console.log(`  No DB match: "${home}" vs "${away}"`);
      continue;
    }

    const book = books[market.marketId];
    if (!book) continue;

    await ingestMarket(market, book, matchId);
  }

  console.log('\nDone.');
}

main().catch(console.error);
