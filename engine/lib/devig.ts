/**
 * Multiplicative devig: normalises decimal odds to fair probabilities
 * by dividing each implied probability by the total overround.
 *
 * @param odds Array of decimal odds for each outcome
 * @returns Array of fair probabilities summing to 1, same order as input
 */
export function devig(odds: number[]): number[] {
  if (odds.length === 0) throw new Error('devig: odds array must be non-empty');
  if (odds.some(o => o <= 1)) throw new Error('devig: all odds must be > 1');

  const implied = odds.map(o => 1 / o);
  const overround = implied.reduce((sum, p) => sum + p, 0);
  return implied.map(p => p / overround);
}
