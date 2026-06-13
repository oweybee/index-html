import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Dixon-Coles team ratings: [attack, defence]
// attack > 1 = above average scorer, defence < 1 = tight defence
const TEAM_RATINGS = {
  'France': [1.45, 0.72],
  'Brazil': [1.42, 0.75],
  'England': [1.38, 0.78],
  'Argentina': [1.40, 0.74],
  'Spain': [1.35, 0.80],
  'Portugal': [1.35, 0.76],
  'Germany': [1.32, 0.82],
  'Netherlands': [1.30, 0.83],
  'Belgium': [1.28, 0.84],
  'Italy': [1.25, 0.85],
  'Croatia': [1.22, 0.87],
  'Uruguay': [1.20, 0.86],
  'Denmark': [1.18, 0.88],
  'Mexico': [1.15, 0.89],
  'Switzerland': [1.15, 0.89],
  'Serbia': [1.12, 0.90],
  'Senegal': [1.12, 0.90],
  'Japan': [1.08, 0.92],
  'Wales': [1.08, 0.92],
  'USA': [1.10, 0.91],
  'Morocco': [1.10, 0.91],
  'South Korea': [1.05, 0.93],
  'Australia': [1.03, 0.94],
  'Ecuador': [1.02, 0.95],
  'Canada': [1.05, 0.93],
  'Poland': [1.10, 0.91],
  'Ghana': [1.00, 0.96],
  'Cameroon': [1.00, 0.96],
  'Tunisia': [0.98, 0.97],
  'Costa Rica': [0.95, 0.98],
  'Qatar': [0.95, 0.98],
  'Iran': [0.92, 0.99],
  'Saudi Arabia': [0.90, 1.00],
  '_default': [1.00, 1.00],
};

const BASE_GOALS = 1.35;
const HOME_ADV = 1.15;
const MAX_GOALS = 7;

const SOFT_BOOKS = [
  'bet365', 'skybet', 'williamhill', 'paddypower', 'coral',
  'ladbrokes_uk', 'betfred_uk', 'betway', 'betvictor', 'boylesports',
  'betfair_sb_uk', 'unibet_uk', 'virginbet', 'sport888',
];

const VALUE_EDGE_MIN = 0.02;
const VALUE_PROB_MIN = 0.40;
const VALUE_ODDS_MAX = 2.80;
const RUBY_PROB_MIN = 0.50;
const RUBY_EDGE_MIN = 0.01;
const RUBY_EDGE_MAX = 0.08;
const RUBY_ODDS_MAX = 2.20;
const RUBY_BOOKS_MIN = 4;

function getTeamRating(name) {
  if (TEAM_RATINGS[name]) return TEAM_RATINGS[name];
  for (const [key, val] of Object.entries(TEAM_RATINGS)) {
    if (key === '_default') continue;
    if (name.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(name.toLowerCase())) {
      return val;
    }
  }
  return TEAM_RATINGS['_default'];
}

function poisson(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  for (let i = 0; i < k; i++) p *= lambda / (i + 1);
  return p;
}

function dixonColes(homeTeam, awayTeam) {
  const [hAtk, hDef] = getTeamRating(homeTeam);
  const [aAtk, aDef] = getTeamRating(awayTeam);
  const lambdaH = BASE_GOALS * hAtk * aDef * HOME_ADV;
  const lambdaA = BASE_GOALS * aAtk * hDef;

  let homeWin = 0, draw = 0, awayWin = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = poisson(i, lambdaH) * poisson(j, lambdaA);
      if (i > j) homeWin += p;
      else if (i === j) draw += p;
      else awayWin += p;
    }
  }
  const total = homeWin + draw + awayWin;
  return {
    home: homeWin / total,
    draw: draw / total,
    away: awayWin / total,
    lambdaH,
    lambdaA,
  };
}

function overProb(lambdaH, lambdaA, line) {
  const target = Math.floor(line);
  let under = 0;
  for (let total = 0; total <= target; total++) {
    for (let i = 0; i <= total; i++) {
      under += poisson(i, lambdaH) * poisson(total - i, lambdaA);
    }
  }
  return 1 - under;
}

function edge(modelProb, bestOdds) {
  if (!bestOdds || bestOdds <= 1) return null;
  return modelProb - 1 / bestOdds;
}

function toFractional(prob) {
  if (!prob || prob <= 0 || prob >= 1) return '—';
  const decimal = 1 / prob;
  const n = Math.round((decimal - 1) * 100);
  const d = 100;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const g = gcd(n, d);
  return `${n / g}/${d / g}`;
}

async function getLatestOddsByBook(matchId, market) {
  const { data } = await supabase
    .from('odds')
    .select('*')
    .eq('match_id', matchId)
    .eq('market', market)
    .order('fetched_at', { ascending: false });

  const latest = {};
  for (const row of data || []) {
    if (!latest[row.bookmaker]) latest[row.bookmaker] = row;
  }
  return Object.values(latest);
}

async function computeMatch(match) {
  const home = match.home_team?.name;
  const away = match.away_team?.name;
  if (!home || !away) return;

  const allH2H = await getLatestOddsByBook(match.id, 'h2h');
  if (allH2H.length === 0) return;

  const betfair = allH2H.find(b => b.bookmaker === 'betfair_ex_uk');
  if (!betfair) {
    console.log(`  Skip ${home} vs ${away} — no Betfair Exchange`);
    return;
  }

  const softOdds = allH2H.filter(b => SOFT_BOOKS.includes(b.bookmaker));
  const softBookCount = softOdds.length;
  if (softBookCount === 0) return;

  // Best soft book price per outcome
  let bestHome = 0, bestHomeBook = null;
  let bestDraw = 0, bestDrawBook = null;
  let bestAway = 0, bestAwayBook = null;
  for (const b of softOdds) {
    if (b.home_odds > bestHome) { bestHome = b.home_odds; bestHomeBook = b.bookmaker; }
    if ((b.draw_odds || 0) > bestDraw) { bestDraw = b.draw_odds; bestDrawBook = b.bookmaker; }
    if (b.away_odds > bestAway) { bestAway = b.away_odds; bestAwayBook = b.bookmaker; }
  }

  const model = dixonColes(home, away);

  const homeEdge = bestHome ? edge(model.home, bestHome) : null;
  const drawEdge = bestDraw ? edge(model.draw, bestDraw) : null;
  const awayEdge = bestAway ? edge(model.away, bestAway) : null;

  const homeValue = homeEdge != null && homeEdge > VALUE_EDGE_MIN
    && model.home >= VALUE_PROB_MIN && bestHome <= VALUE_ODDS_MAX;
  const drawValue = drawEdge != null && drawEdge > VALUE_EDGE_MIN
    && model.draw >= VALUE_PROB_MIN && bestDraw <= VALUE_ODDS_MAX;
  const awayValue = awayEdge != null && awayEdge > VALUE_EDGE_MIN
    && model.away >= VALUE_PROB_MIN && bestAway <= VALUE_ODDS_MAX;

  const homeRuby = homeValue
    && model.home >= RUBY_PROB_MIN
    && homeEdge >= RUBY_EDGE_MIN && homeEdge <= RUBY_EDGE_MAX
    && bestHome <= RUBY_ODDS_MAX && softBookCount >= RUBY_BOOKS_MIN;
  const awayRuby = awayValue
    && model.away >= RUBY_PROB_MIN
    && awayEdge >= RUBY_EDGE_MIN && awayEdge <= RUBY_EDGE_MAX
    && bestAway <= RUBY_ODDS_MAX && softBookCount >= RUBY_BOOKS_MIN;

  // How many soft books offer value on at least one outcome
  const valueBookCount = softOdds.filter(b => {
    const hE = b.home_odds ? model.home - 1 / b.home_odds : -1;
    const dE = b.draw_odds ? model.draw - 1 / b.draw_odds : -1;
    const aE = b.away_odds ? model.away - 1 / b.away_odds : -1;
    return Math.max(hE, dE, aE) > VALUE_EDGE_MIN;
  }).length;

  // Totals market
  const allTotals = await getLatestOddsByBook(match.id, 'totals');
  const softTotals = allTotals.filter(b => SOFT_BOOKS.includes(b.bookmaker));

  let bestOver = 0, bestOverBook = null;
  let bestUnder = 0, bestUnderBook = null;
  let totalsLine = 2.5;
  for (const b of softTotals) {
    if ((b.home_odds || 0) > bestOver) { bestOver = b.home_odds; bestOverBook = b.bookmaker; }
    if ((b.away_odds || 0) > bestUnder) { bestUnder = b.away_odds; bestUnderBook = b.bookmaker; }
    if (b.market_line) totalsLine = b.market_line;
  }

  const op = overProb(model.lambdaH, model.lambdaA, totalsLine);
  const overEdge = bestOver ? edge(op, bestOver) : null;
  const underEdge = bestUnder ? edge(1 - op, bestUnder) : null;
  const overValue = overEdge != null && overEdge > VALUE_EDGE_MIN && bestOver <= VALUE_ODDS_MAX;
  const underValue = underEdge != null && underEdge > VALUE_EDGE_MIN && bestUnder <= VALUE_ODDS_MAX;

  // Max edge across all markets
  const allEdges = [homeEdge, drawEdge, awayEdge, overEdge, underEdge].filter(e => e != null && e > 0);
  const maxEdge = allEdges.length > 0 ? Math.max(...allEdges) : null;

  // MES: edge_score (40) + agreement_score (35) + liquidity_score (25)
  let mesScore = 0;
  if (maxEdge != null) {
    const edgeScore = Math.min(maxEdge / 0.10, 1.0) * 40;
    const agreementScore = softBookCount > 0 ? (valueBookCount / softBookCount) * 35 : 0;
    const liquidityScore = Math.min(softBookCount / 8, 1.0) * 25;
    mesScore = Math.round(edgeScore + agreementScore + liquidityScore);
  }

  const row = {
    match_id: match.id,
    best_home_odds: bestHome || null,
    best_draw_odds: bestDraw || null,
    best_away_odds: bestAway || null,
    best_home_book: bestHomeBook,
    best_draw_book: bestDrawBook,
    best_away_book: bestAwayBook,
    fair_home_odds: toFractional(model.home),
    fair_draw_odds: toFractional(model.draw),
    fair_away_odds: toFractional(model.away),
    home_edge: homeEdge,
    draw_edge: drawEdge,
    away_edge: awayEdge,
    home_value: homeValue,
    draw_value: drawValue,
    away_value: awayValue,
    home_ruby: homeRuby,
    draw_ruby: false,
    away_ruby: awayRuby,
    over_odds: bestOver || null,
    under_odds: bestUnder || null,
    over_book: bestOverBook,
    under_book: bestUnderBook,
    over_edge: overEdge,
    under_edge: underEdge,
    over_value: overValue,
    under_value: underValue,
    totals_line: totalsLine,
    soft_book_count: softBookCount,
    value_book_count: valueBookCount,
    mes_score: mesScore,
    odds_fetched_at: allH2H[0]?.fetched_at ?? null,
    computed_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await supabase
    .from('computed_values')
    .upsert(row, { onConflict: 'match_id' });

  if (upsertErr) {
    console.error(`  Error ${home} vs ${away}:`, upsertErr.message);
  } else {
    const tag = homeRuby || awayRuby ? 'RUBY' : homeValue || drawValue || awayValue ? 'VALUE' : '     ';
    console.log(`  ${tag} ${home} vs ${away} — edge=${maxEdge?.toFixed(3) ?? 'n/a'} MES=${mesScore}`);
  }
}

async function main() {
  console.log('Computing values…');

  const { data: matches, error } = await supabase
    .from('matches')
    .select(`
      id, kickoff_at,
      home_team:teams!matches_home_team_id_fkey (name),
      away_team:teams!matches_away_team_id_fkey (name)
    `)
    .eq('status', 'scheduled');

  if (error) throw error;
  if (!matches || matches.length === 0) {
    console.log('No scheduled matches found.');
    return;
  }

  console.log(`Processing ${matches.length} matches…\n`);
  for (const match of matches) {
    await computeMatch(match);
  }
  console.log('\nDone.');
}

main().catch(console.error);
