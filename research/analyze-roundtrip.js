/**
 * Analyze the round-trip: scores → preferences → rankings
 *
 * Question: What damping factor best recovers the original score distribution
 * when preferences are generated synthetically from scores?
 */

const fs = require('fs');
const path = require('path');
const linAlg = require('linear-algebra')();

// Damping-based ranker
class DampingPowerRanker {
  constructor ({ items }) {
    this.items = Array.from(items).sort((a, b) => a.localeCompare(b));
    this.numPreferences = 0;
    this.totalAbsScaled = 0;
    const n = this.items.length;
    this.matrix = linAlg.Matrix.zero(n, n);
  }

  #toItemMap (items) { return new Map(items.map((item, ix) => [ item, ix ])); }
  #sum (array) { return array.reduce((sum, val) => sum + val, 0); }
  #norm (array) { return Math.sqrt(this.#sum(array.map(x => x * x))); }
  #sumColumns (matrix) { return matrix.trans().data.map(col => this.#sum(col)); }

  addPreferences (preferences) {
    const matrix = this.matrix;
    const itemMap = this.#toItemMap(this.items);
    preferences.forEach((p) => {
      const targetIx = itemMap.get(p.target);
      const sourceIx = itemMap.get(p.source);
      if (targetIx === undefined || sourceIx === undefined) return;

      matrix.data[sourceIx][targetIx] += p.value;
      matrix.data[targetIx][sourceIx] += (1 - p.value);
      this.totalAbsScaled += Math.abs(2 * (p.value - 0.5));
      this.numPreferences++;
    });
    this.#sumColumns(matrix).forEach((sum, ix) => { matrix.data[ix][ix] = sum; });
  }

  run ({ d }) {
    const n = this.items.length;
    const matrix = this.matrix.clone();
    matrix.data = matrix.data.map((row) => {
      const rowSum = this.#sum(row);
      return rowSum > 0 ? row.map(x => x / rowSum) : row.map(() => 1 / n);
    });
    matrix.mulEach_(d);
    matrix.plusEach_((1 - d) / n);

    let eigenvector = linAlg.Vector.zero(n).plusEach(1.0 / n);
    let prev = eigenvector;
    for (let i = 0; i < 1000; i++) {
      eigenvector = prev.dot(matrix);
      if (this.#norm(eigenvector.minus(prev).data[0]) < 0.001) break;
      prev = eigenvector;
    }

    const itemMap = this.#toItemMap(this.items);
    const weights = eigenvector.data[0];
    itemMap.forEach((ix, item) => itemMap.set(item, weights[ix]));
    return itemMap;
  }
}

// Replicate the preference generation logic
function generatePreferencesFromScores (chores) {
  const preferences = [];

  for (let i = 0; i < chores.length; i++) {
    for (let j = i + 1; j < chores.length; j++) {
      const [ a, b ] = [ chores[i], chores[j] ];
      const [ target, source ] = a.score >= b.score ? [ a, b ] : [ b, a ];

      // Power-scaled ratio to stretch preferences towards [0, 1]
      const ratio = target.score / source.score;
      const preference = (ratio ** 2) / ((ratio ** 2) + 1);

      preferences.push({
        target: target.name,
        source: source.name,
        value: preference,
      });
    }
  }

  return preferences;
}

function parsePointsCSV (filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.trim().split('\n');
  const chores = [];

  lines.slice(1).forEach((line) => {
    const match = line.match(/^([^,]+),(\d+)/);
    if (match) {
      chores.push({ name: match[1].trim(), score: parseInt(match[2]) });
    }
  });

  return chores;
}

function normalizeToDistribution (values) {
  const sum = values.reduce((a, b) => a + b, 0);
  return values.map(v => v / sum);
}

function computeSpread (values) {
  const arr = Array.from(values);
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = Math.sqrt(arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length);
  return { min, max, ratio: max / min, std, cv: std / mean };
}

function rmse (a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum / a.length);
}

function spearmanCorrelation (x, y) {
  const n = x.length;
  const rankX = getRanks(x);
  const rankY = getRanks(y);
  let d2sum = 0;
  for (let i = 0; i < n; i++) {
    d2sum += (rankX[i] - rankY[i]) ** 2;
  }
  return 1 - (6 * d2sum) / (n * (n * n - 1));
}

function getRanks (arr) {
  const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const ranks = new Array(arr.length);
  sorted.forEach((item, rank) => { ranks[item.i] = rank + 1; });
  return ranks;
}

// Main
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║     Round-Trip Analysis: Scores → Preferences → Rankings      ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const pointsPath = path.join(__dirname, '..', 'points-solegria-5.csv');
const chores = parsePointsCSV(pointsPath);

console.log(`Loaded ${chores.length} chores with scores\n`);

// Analyze the original score distribution
const scores = chores.map(c => c.score);
const scoreSpread = computeSpread(scores);
const normalizedScores = normalizeToDistribution(scores); // eslint-disable-line no-unused-vars

console.log('=== Original Score Distribution ===');
console.log(`Scores range: ${scoreSpread.min} to ${scoreSpread.max}`);
console.log(`Ratio (max/min): ${scoreSpread.ratio.toFixed(2)}x`);
console.log(`CV: ${(scoreSpread.cv * 100).toFixed(1)}%`);
console.log();

// Generate preferences from scores
const preferences = generatePreferencesFromScores(chores);
const avgAbsScaled = preferences.reduce((sum, p) => sum + Math.abs(2 * (p.value - 0.5)), 0) / preferences.length;
const extremePrefs = preferences.filter(p => p.value > 0.95 || p.value < 0.05).length;

console.log('=== Generated Preferences ===');
console.log(`Total pairs: ${preferences.length}`);
console.log(`Extreme (>0.95 or <0.05): ${extremePrefs} (${(100 * extremePrefs / preferences.length).toFixed(1)}%)`);
console.log(`Average |scaled|: ${avgAbsScaled.toFixed(4)}`);
console.log();

// Show preference generation for extreme pairs
console.log('Sample preference mappings (score ratio → preference):');
const sampleRatios = [ 1, 1.5, 2, 3, 5, 10 ];
for (const ratio of sampleRatios) {
  const pref = (ratio ** 2) / ((ratio ** 2) + 1);
  console.log(`  ${ratio}x → ${pref.toFixed(4)}`);
}
console.log();

// Test different damping values
console.log('=== Finding Optimal Damping for Score Recovery ===\n');
console.log('d\t\tRatio\t\tRMSE\t\tSpearman');
console.log('-'.repeat(60));

const choreNames = chores.map(c => c.name);
const results = [];

for (let d = 0.50; d <= 0.995; d += 0.025) {
  const ranker = new DampingPowerRanker({ items: new Set(choreNames) });
  ranker.addPreferences(preferences);
  const rankings = ranker.run({ d });

  // Get rankings in same order as chores
  const rankingValues = choreNames.map(name => rankings.get(name));
  const rankingSpread = computeSpread(rankingValues);
  const error = rmse(normalizedScores, rankingValues);
  const corr = spearmanCorrelation(scores, rankingValues);

  results.push({ d, ratio: rankingSpread.ratio, rmse: error, corr });
  console.log(`${d.toFixed(3)}\t\t${rankingSpread.ratio.toFixed(2)}x\t\t${error.toFixed(6)}\t${corr.toFixed(4)}`);
}

// Find best by different metrics
const bestByRatio = results.reduce((best, r) =>
  Math.abs(r.ratio - scoreSpread.ratio) < Math.abs(best.ratio - scoreSpread.ratio) ? r : best,
);
const bestByRMSE = results.reduce((best, r) => r.rmse < best.rmse ? r : best);
const bestByCorr = results.reduce((best, r) => r.corr > best.corr ? r : best);

console.log();
console.log('=== Optimal Damping by Metric ===');
console.log(`Target ratio: ${scoreSpread.ratio.toFixed(2)}x`);
console.log();
console.log(`Best for ratio match:  d=${bestByRatio.d.toFixed(3)} (ratio=${bestByRatio.ratio.toFixed(2)}x)`);
console.log(`Best for RMSE:         d=${bestByRMSE.d.toFixed(3)} (RMSE=${bestByRMSE.rmse.toFixed(6)})`);
console.log(`Best for correlation:  d=${bestByCorr.d.toFixed(3)} (ρ=${bestByCorr.corr.toFixed(4)})`);
console.log();

// Compute what α would produce these damping values
const n = chores.length;
const maxPairs = n * (n - 1) / 2;
const P = preferences.length;

console.log('=== Implied α Values ===');
console.log('(Using formula: d = P / (P + α * maxPairs))');
console.log(`P = ${P}, maxPairs = ${maxPairs}`);
console.log();

for (const { label, d } of [
  { label: 'Ratio-matched', d: bestByRatio.d },
  { label: 'RMSE-optimal', d: bestByRMSE.d },
  { label: 'Correlation-optimal', d: bestByCorr.d },
]) {
  const alpha = (P / d - P) / maxPairs;
  console.log(`${label}: d=${d.toFixed(3)} → α=${alpha.toFixed(4)}`);
}

console.log();
console.log('=== Side-by-Side: Scores vs Rankings ===\n');

// Get rankings at key damping values
const dampingTests = [
  { d: 0.52, label: 'α=0.5' },
  { d: bestByRMSE.d, label: 'RMSE-opt' },
  { d: bestByCorr.d, label: 'Corr-opt' },
  { d: 0.99, label: 'd=0.99' },
];

const allRankings = dampingTests.map(({ d }) => {
  const ranker = new DampingPowerRanker({ items: new Set(choreNames) });
  ranker.addPreferences(preferences);
  return ranker.run({ d });
});

console.log('Chore'.padEnd(45) + 'Score\tNorm%\t' + dampingTests.map(t => t.label).join('\t'));
console.log('-'.repeat(45 + 8 + 8 + dampingTests.length * 10));

// Sort by score descending
const sortedChores = [ ...chores ].sort((a, b) => b.score - a.score);

for (const chore of sortedChores) {
  const normScore = (chore.score / scores.reduce((a, b) => a + b, 0) * 100).toFixed(2);
  const rankingStrs = allRankings.map(r => (r.get(chore.name) * 100).toFixed(2) + '%');
  console.log(chore.name.substring(0, 43).padEnd(45) + chore.score + '\t' + normScore + '%\t' + rankingStrs.join('\t'));
}

console.log();
console.log('=== Key Insight ===');
console.log('The preference generation formula maps score ratios to preferences via:');
console.log('  preference = ratio² / (ratio² + 1)');
console.log();
console.log(`For scores ranging ${scoreSpread.min}-${scoreSpread.max} (${scoreSpread.ratio.toFixed(1)}x):`);
console.log(`  - The generated preferences have avgAbsScaled = ${avgAbsScaled.toFixed(3)}`);
console.log(`  - Adaptive α = ${(avgAbsScaled / 2).toFixed(3)} would give d = ${(P / (P + avgAbsScaled / 2 * maxPairs)).toFixed(3)}`);
console.log();
console.log('To best recover the original score distribution:');
console.log(`  - RMSE-optimal: d = ${bestByRMSE.d.toFixed(3)}`);
console.log(`  - This implies the current α=0.5 formula ${bestByRMSE.d > 0.52 ? 'UNDER-damps' : 'OVER-damps'} for synthetic preferences`);
