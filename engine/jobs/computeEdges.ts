import { supabase } from '../lib/supabaseClient';
import { getOddsApiSnapshot, getBestRetailOdds } from '../lib/oddsApi';
import { getBetfairBackPrices } from '../lib/betfairClient';
import { devig } from '../lib/devig';

const TARGET_LEAGUES = ['fifa_world_cup_2026'];

// Bias-correction constants from Kaunitz et al. (2017), Eq. 4 & 8.
// p_real ≈ p_cons - α, where p_cons = 1 / mean(bookmaker_odds).
// Calibrated on 479,440 games across 818 leagues, 2005-2015.
// α = 0.05 used as the betting threshold in the paper; outcome-specific
// values are used here for a more accurate fair probability estimate.
const ALPHA = { home: 0.034, draw: 0.057, away: 0.037 } as const;

const MIN_BOOKMAKERS = 3;

export async function runEdgeComputeCycle(): Promise<void> {
  const fixtures = await getOddsApiSnapshot(TARGET_LEAGUES);

  for (const fixture of fixtures) {
    const { bookmakers } = fixture;
    if (bookmakers.length < MIN_BOOKMAKERS) continue;

    const bestRetail = getBestRetailOdds(bookmakers);

    // Betfair back prices as optional second signal
    const betfairPrices = await getBetfairBackPrices(fixture.eventId);
    const fairProbBetfair = betfairPrices
      ? devig([betfairPrices.home, betfairPrices.draw, betfairPrices.away])
      : null;

    const outcomes = ['home', 'draw', 'away'] as const;
    const edges = outcomes.map((outcome, i) => {
      // Consensus probability: inverse of mean odds across all bookmakers
      const allOdds = bookmakers.map(b => b[outcome]);
      const meanOdds = allOdds.reduce((s, o) => s + o, 0) / allOdds.length;
      const pCons = 1 / meanOdds;

      // Bias-corrected fair probability (Eq. 4)
      const pFairKaunitz = pCons - ALPHA[outcome];

      // Best available retail odds for this outcome
      const maxOdds = bestRetail[outcome];

      // Expected payoff per unit staked (Eq. 5): E(Π) = p_fair × max_odds - 1
      const edgeKaunitz = pFairKaunitz * maxOdds - 1;

      const pFairBetfair = fairProbBetfair?.[i] ?? null;
      const edgeBetfair =
        pFairBetfair !== null ? pFairBetfair - 1 / maxOdds : null;

      // RUBY: both signals independently confirm positive edge
      const signalsAgree =
        edgeKaunitz > 0 && edgeBetfair !== null && edgeBetfair > 0;

      return {
        outcome,
        p_cons: pCons,
        p_fair_kaunitz: pFairKaunitz,
        p_fair_betfair: pFairBetfair,
        edge_kaunitz: edgeKaunitz,
        edge_betfair: edgeBetfair,
        bookmaker_count: allOdds.length,
        signals_agree: signalsAgree,
        tier: signalsAgree ? 'RUBY' : edgeKaunitz > 0 ? 'VALUE' : null,
      };
    });

    const { error } = await supabase
      .from('edge_signals')
      .upsert(
        edges.map(e => ({
          fixture_id: fixture.eventId,
          computed_at: new Date().toISOString(),
          ...e,
        })),
        { onConflict: 'fixture_id,outcome' }
      );

    if (error) {
      console.error(`upsert failed for fixture ${fixture.eventId}:`, error.message);
    }
  }
}
