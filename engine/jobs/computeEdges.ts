import { supabase } from '../lib/supabaseClient';
import { getOddsApiSnapshot, getBestRetailOdds } from '../lib/oddsApi';
import { getBetfairBackPrices } from '../lib/betfairClient';
import { devig } from '../lib/devig';
import { getDixonColesProbabilities } from '../models/dixonColes';

const TARGET_LEAGUES = ['epl', 'efl_championship'];

export async function runEdgeComputeCycle(): Promise<void> {
  const fixtures = await getOddsApiSnapshot(TARGET_LEAGUES);

  for (const fixture of fixtures) {
    // 1. Best retail odds across the 5 tracked books
    const bestRetail = getBestRetailOdds(fixture.bookmakers);

    // 2. Betfair fair value
    const betfairPrices = await getBetfairBackPrices(fixture.eventId);
    if (!betfairPrices) continue;

    const fairProbBetfair = devig([
      betfairPrices.home,
      betfairPrices.draw,
      betfairPrices.away,
    ]);

    // 3. Dixon-Coles fair value
    const fairProbDC = await getDixonColesProbabilities(fixture.homeTeam, fixture.awayTeam);
    if (!fairProbDC) continue;

    // 4. Edge per outcome, per source
    const outcomes = ['home', 'draw', 'away'] as const;
    const edges = outcomes.map((outcome, i) => {
      const impliedRetail = 1 / bestRetail[outcome];
      const edgeBetfair = fairProbBetfair[i] - impliedRetail;
      const edgeDC = fairProbDC[outcome] - impliedRetail;
      const signalsAgree = Math.sign(edgeBetfair) === Math.sign(edgeDC) && edgeBetfair > 0;

      return {
        outcome,
        fair_prob_betfair: fairProbBetfair[i],
        fair_prob_dc: fairProbDC[outcome],
        edge_betfair: edgeBetfair,
        edge_dc: edgeDC,
        signals_agree: signalsAgree,
        tier: signalsAgree ? 'RUBY' : edgeBetfair > 0 || edgeDC > 0 ? 'VALUE' : null,
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
