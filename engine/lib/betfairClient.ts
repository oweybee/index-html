import axios from 'axios';

const BETFAIR_API_KEY = process.env.BETFAIR_API_KEY;
const BETFAIR_SESSION_TOKEN = process.env.BETFAIR_SESSION_TOKEN;
const BETFAIR_BASE_URL = 'https://api.betfair.com/exchange/betting/rest/v1.0';

export interface BetfairBackPrices {
  home: number;
  draw: number;
  away: number;
}

// Maps from our internal event IDs (OddsAPI format) to Betfair market IDs.
// In production this would query Betfair's listEvents/listMarketCatalogue to
// find the correct 1X2 market, then cache the mapping.
const marketIdCache = new Map<string, string>();

async function resolveMarketId(eventId: string): Promise<string | null> {
  if (marketIdCache.has(eventId)) return marketIdCache.get(eventId)!;

  if (!BETFAIR_API_KEY || !BETFAIR_SESSION_TOKEN) {
    throw new Error('BETFAIR_API_KEY and BETFAIR_SESSION_TOKEN must be set');
  }

  // List soccer markets with eventId filter — Betfair eventId differs from
  // OddsAPI's; this assumes the caller has resolved them upstream or a
  // separate mapping table exists.  Return null to skip unresolvable events.
  const res = await axios.post(
    `${BETFAIR_BASE_URL}/listMarketCatalogue/`,
    {
      filter: {
        eventIds: [eventId],
        marketTypeCodes: ['MATCH_ODDS'],
      },
      maxResults: 1,
      marketProjection: ['MARKET_START_TIME'],
    },
    {
      headers: {
        'X-Application': BETFAIR_API_KEY,
        'X-Authentication': BETFAIR_SESSION_TOKEN,
        'Content-Type': 'application/json',
      },
    }
  );

  const market = res.data?.[0];
  if (!market) return null;

  marketIdCache.set(eventId, market.marketId);
  return market.marketId;
}

export async function getBetfairBackPrices(eventId: string): Promise<BetfairBackPrices | null> {
  if (!BETFAIR_API_KEY || !BETFAIR_SESSION_TOKEN) {
    throw new Error('BETFAIR_API_KEY and BETFAIR_SESSION_TOKEN must be set');
  }

  const marketId = await resolveMarketId(eventId);
  if (!marketId) return null;

  const res = await axios.post(
    `${BETFAIR_BASE_URL}/listMarketBook/`,
    {
      marketIds: [marketId],
      priceProjection: {
        priceData: ['EX_BEST_OFFERS'],
        exBestOffersOverrides: { bestPricesDepth: 1 },
        virtualise: true,
      },
    },
    {
      headers: {
        'X-Application': BETFAIR_API_KEY,
        'X-Authentication': BETFAIR_SESSION_TOKEN,
        'Content-Type': 'application/json',
      },
    }
  );

  const book = res.data?.[0];
  if (!book?.runners || book.runners.length < 3) return null;

  // Betfair runner order: [home, draw, away] by sortPriority
  const sorted = [...book.runners].sort(
    (a: { sortPriority: number }, b: { sortPriority: number }) => a.sortPriority - b.sortPriority
  );

  const bestBack = (runner: { ex?: { availableToBack?: { price: number }[] } }) =>
    runner.ex?.availableToBack?.[0]?.price ?? null;

  const home = bestBack(sorted[0]);
  const draw = bestBack(sorted[1]);
  const away = bestBack(sorted[2]);

  if (!home || !draw || !away) return null;

  return { home, draw, away };
}
