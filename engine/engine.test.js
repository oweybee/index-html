import { strict as assert } from 'assert';

// ── Poisson distribution ──────────────────────────────────────────────────────

function poisson(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  for (let i = 0; i < k; i++) p *= lambda / (i + 1);
  return p;
}

function matchProbs(lambdaH, lambdaA) {
  let home = 0, draw = 0, away = 0;
  for (let i = 0; i <= 7; i++) {
    for (let j = 0; j <= 7; j++) {
      const p = poisson(i, lambdaH) * poisson(j, lambdaA);
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
    }
  }
  return { home, draw, away, total: home + draw + away };
}

function testProbsSum() {
  const r = matchProbs(1.5, 1.2);
  assert(Math.abs(r.total - 1.0) < 0.005, `probs sum=${r.total}`);
  assert(r.home > r.away, 'home should be favourite when lambdaH > lambdaA');
  console.log('✓ Match probabilities sum to ~1');
}

// ── Edge calculation ──────────────────────────────────────────────────────────

function calcEdge(modelProb, bestOdds) {
  if (!bestOdds || bestOdds <= 1) return null;
  return modelProb - 1 / bestOdds;
}

function testEdge() {
  const e = calcEdge(0.55, 2.10);
  assert(e != null && e > 0, 'edge should be positive');
  assert(Math.abs(e - (0.55 - 1 / 2.10)) < 0.0001, `edge=${e}`);
  assert(calcEdge(0.30, 2.10) < 0, 'negative edge when model prob < implied');
  assert(calcEdge(0.50, 1) == null, 'invalid odds returns null');
  console.log('✓ Edge calculation correct');
}

// ── Value flags ───────────────────────────────────────────────────────────────

function isValue(edge, modelProb, bestOdds) {
  return edge > 0.02 && modelProb >= 0.40 && bestOdds <= 2.80;
}

function testValueFlags() {
  assert(isValue(0.025, 0.45, 2.60), 'should be value');
  assert(!isValue(0.015, 0.45, 2.60), 'edge too low');
  assert(!isValue(0.025, 0.35, 2.60), 'prob too low');
  assert(!isValue(0.025, 0.45, 2.90), 'odds too long');
  console.log('✓ Value flag logic correct');
}

// ── Ruby flags ────────────────────────────────────────────────────────────────

function isRuby(val, modelProb, edge, bestOdds, softBooks) {
  return val && modelProb >= 0.50 && edge >= 0.01 && edge <= 0.08
    && bestOdds <= 2.20 && softBooks >= 4;
}

function testRubyFlags() {
  assert(isRuby(true, 0.55, 0.04, 2.10, 5), 'should be ruby');
  assert(!isRuby(false, 0.55, 0.04, 2.10, 5), 'requires value=true');
  assert(!isRuby(true, 0.45, 0.04, 2.10, 5), 'prob too low for ruby');
  assert(!isRuby(true, 0.55, 0.09, 2.10, 5), 'edge too high (suspicious)');
  assert(!isRuby(true, 0.55, 0.04, 2.30, 5), 'odds too long for ruby');
  assert(!isRuby(true, 0.55, 0.04, 2.10, 3), 'not enough books');
  console.log('✓ Ruby flag logic correct');
}

// ── MES score ─────────────────────────────────────────────────────────────────

function mesScore(maxEdge, valueBookCount, softBookCount) {
  const edgeScore = Math.min(maxEdge / 0.10, 1.0) * 40;
  const agreementScore = softBookCount > 0 ? (valueBookCount / softBookCount) * 35 : 0;
  const liquidityScore = Math.min(softBookCount / 8, 1.0) * 25;
  return Math.round(edgeScore + agreementScore + liquidityScore);
}

function testMES() {
  const mes = mesScore(0.08, 4, 8);
  assert(mes >= 0 && mes <= 100, `MES=${mes} out of bounds`);
  assert(mesScore(0.10, 8, 8) === 100, 'perfect MES should be 100');
  assert(mesScore(0, 0, 0) === 0, 'zero edge = MES 0');
  console.log(`✓ MES score within bounds (sample: ${mes})`);
}

// ── Over probability ──────────────────────────────────────────────────────────

function calcOverProb(lambdaH, lambdaA, line) {
  const target = Math.floor(line);
  let under = 0;
  for (let total = 0; total <= target; total++) {
    for (let i = 0; i <= total; i++) {
      under += poisson(i, lambdaH) * poisson(total - i, lambdaA);
    }
  }
  return 1 - under;
}

function testOverProb() {
  const op = calcOverProb(1.5, 1.2, 2.5);
  assert(op > 0 && op < 1, 'over prob must be 0-1');
  // With ~2.7 expected goals, over 2.5 should be likely
  assert(op > 0.4, `over prob should be meaningful, got ${op}`);
  console.log(`✓ Over 2.5 probability: ${(op * 100).toFixed(1)}%`);
}

// ── Run all ───────────────────────────────────────────────────────────────────

testProbsSum();
testEdge();
testValueFlags();
testRubyFlags();
testMES();
testOverProb();

console.log('\nAll tests passed.');
