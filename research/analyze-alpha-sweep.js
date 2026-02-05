/**
 * Alpha Parameterization Analysis
 *
 * Compares how different α values affect rankings relative to current production.
 * Goal: Find α that only slightly increases expressiveness.
 *
 * NEW Formula: d = P / (P + α × maxPairs)
 * Where P = total preferences, maxPairs = n × (n-1) / 2
 */

const fs = require('fs');
const path = require('path');
const linAlg = require('linear-algebra')();

// ============================================================================
// CURRENT PRODUCTION IMPLEMENTATION (from main branch)
// Uses implicit preferences, unidirectional explicit, fixed d=0.99
// ============================================================================
class CurrentPowerRanker {
  constructor ({ items, numResidents }) {
    this.items = Array.from(items).sort((a, b) => a.localeCompare(b));
    this.numResidents = numResidents;
    const n = this.items.length;

    // implicitPref = (1 / numResidents) / 2
    const implicitPref = (1 / numResidents) / 2;
    this.implicitPref = implicitPref;

    // Initialize matrix with implicit preferences on all off-diagonals
    // Each cell gets numResidents * implicitPref = 0.5
    let matrix = linAlg.Matrix.zero(n, n);
    matrix = matrix.plusEach(1).minus(linAlg.Matrix.identity(n)).mulEach(numResidents).mulEach(implicitPref);
    this.matrix = matrix;
  }

  #toItemMap (items) { return new Map(items.map((item, ix) => [ item, ix ])); }
  #sum (array) { return array.reduce((s, v) => s + v, 0); }
  #norm (array) { return Math.sqrt(this.#sum(array.map(x => x * x))); }
  #sumColumns (matrix) { return matrix.trans().data.map(col => this.#sum(col)); }

  addPreferences (preferences) {
    const matrix = this.matrix;
    const itemMap = this.#toItemMap(this.items);
    const implicitPref = this.implicitPref;

    preferences.forEach((p) => {
      const targetIx = itemMap.get(p.target);
      const sourceIx = itemMap.get(p.source);
      if (targetIx === undefined || sourceIx === undefined) return;

      // Scale preference so 0.5 is truly neutral (contributes 0)
      const scaled = (p.value - 0.5) * 2;

      if (scaled !== 0) {
        // Remove the implicit neutral preference from BOTH directions
        matrix.data[sourceIx][targetIx] -= implicitPref;
        matrix.data[targetIx][sourceIx] -= implicitPref;

        // Add scaled preference to ONE direction only
        if (scaled > 0) {
          matrix.data[sourceIx][targetIx] += scaled;
        } else {
          matrix.data[targetIx][sourceIx] += -scaled;
        }
      }
    });

    // Update diagonals
    this.#sumColumns(matrix).forEach((sum, ix) => { matrix.data[ix][ix] = sum; });
  }

  run () {
    const d = 0.99; // Fixed damping factor in production
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
    return { rankings: itemMap, damping: d };
  }
}

// ============================================================================
// NEW PROPOSED IMPLEMENTATION
// No implicit preferences, scaled unidirectional explicit, sigmoid damping
// Formula: d = 1 / (1 + exp(-a × P / maxPairs))
// Where P = total preferences, maxPairs = n × (n-1) / 2
// ============================================================================
class NewPowerRanker {
  constructor ({ items }) {
    this.items = Array.from(items).sort((a, b) => a.localeCompare(b));
    this.numPrefs = 0;
    const n = this.items.length;
    this.matrix = linAlg.Matrix.zero(n, n);
  }

  #toItemMap (items) { return new Map(items.map((item, ix) => [ item, ix ])); }
  #sum (array) { return array.reduce((s, v) => s + v, 0); }
  #norm (array) { return Math.sqrt(this.#sum(array.map(x => x * x))); }
  #sumColumns (matrix) { return matrix.trans().data.map(col => this.#sum(col)); }

  addPreferences (preferences) {
    const matrix = this.matrix;
    const itemMap = this.#toItemMap(this.items);

    preferences.forEach((p) => {
      const targetIx = itemMap.get(p.target);
      const sourceIx = itemMap.get(p.source);
      if (targetIx === undefined || sourceIx === undefined) return;

      // Scaled unidirectional: 0.5 is neutral, only preferred item gains
      const scaled = (p.value - 0.5) * 2;
      if (scaled > 0) {
        matrix.data[sourceIx][targetIx] += scaled;
      } else if (scaled < 0) {
        matrix.data[targetIx][sourceIx] += Math.abs(scaled);
      }

      // Track total preferences
      this.numPrefs++;
    });

    // Update diagonals
    this.#sumColumns(matrix).forEach((sum, ix) => { matrix.data[ix][ix] = sum; });
  }

  _computeDamping (a) {
    const n = this.items.length;
    const maxPairs = n * (n - 1) / 2;
    const coverage = this.numPrefs / maxPairs;
    return 1 / (1 + Math.exp(-a * coverage));
  }

  run (a) {
    const d = this._computeDamping(a);
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

    return { rankings: itemMap, damping: d, numPrefs: this.numPrefs };
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function parseCSV (csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n').slice(1);

  return lines.map((line) => {
    const match = line.match(/^\d+,"([^"]+)","([^"]+)","([^"]+)","([^"]+)"/);
    if (!match) return null;
    return {
      residentId: match[1],
      alphaChore: match[2],
      betaChore: match[3],
      preference: parseFloat(match[4]),
    };
  }).filter(Boolean);
}

function getUniqueChores (preferences) {
  const chores = new Set();
  preferences.forEach((p) => {
    chores.add(p.alphaChore);
    chores.add(p.betaChore);
  });
  return chores;
}

function computeRMSE (map1, map2) {
  let sumSq = 0;
  let count = 0;
  map1.forEach((v1, key) => {
    const v2 = map2.get(key);
    if (v2 !== undefined) {
      sumSq += (v1 - v2) ** 2;
      count++;
    }
  });
  return Math.sqrt(sumSq / count);
}

function computeSpread (rankings) {
  const values = Array.from(rankings.values());
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, ratio: max / min };
}

// ============================================================================
// ANALYSIS
// ============================================================================

function analyzeDataset (name, csvPath, numResidents, alphaValues) {
  const preferences = parseCSV(csvPath);
  const chores = getUniqueChores(preferences);
  const numItems = chores.size;

  const prefs = preferences.map(p => ({
    target: p.alphaChore,
    source: p.betaChore,
    value: p.preference,
    residentId: p.residentId,
  }));

  // Current implementation
  const currentRanker = new CurrentPowerRanker({ items: chores, numResidents });
  currentRanker.addPreferences(prefs);
  const currentResult = currentRanker.run();
  const currentSpread = computeSpread(currentResult.rankings);

  // Get participation info
  const prefsByResident = {};
  prefs.forEach((p) => {
    prefsByResident[p.residentId] = (prefsByResident[p.residentId] || 0) + 1;
  });
  const maxPairs = numItems * (numItems - 1) / 2;

  console.log(`\n${'═'.repeat(100)}`);
  console.log(`  ${name}`);
  console.log('═'.repeat(100));
  console.log(`\n  Items: ${numItems}  |  Preferences: ${preferences.length}  |  maxPairs: ${maxPairs}  |  Residents: ${numResidents}`);
  console.log('\n  Participation breakdown:');
  Object.entries(prefsByResident).forEach(([ id, count ]) => {
    console.log(`    ${id.slice(0, 12).padEnd(12)}: ${count} prefs`);
  });

  const minPct = (currentSpread.min * 100).toFixed(2);
  const maxPct = (currentSpread.max * 100).toFixed(2);
  console.log(`\n  CURRENT (d=0.99, implicit prefs): spread = ${currentSpread.ratio.toFixed(2)}x (${minPct}% - ${maxPct}%)`);

  console.log(`\n  ${'─'.repeat(80)}`);
  console.log(`  ${'α'.padEnd(8)} ${'damping'.padStart(10)} ${'spread'.padStart(10)} ${'RMSE'.padStart(10)} ${'Δ spread'.padStart(10)}`);
  console.log(`  ${'─'.repeat(80)}`);

  const results = [];

  alphaValues.forEach((alpha) => {
    const newRanker = new NewPowerRanker({ items: chores });
    newRanker.addPreferences(prefs);
    const newResult = newRanker.run(alpha);
    const newSpread = computeSpread(newResult.rankings);
    const rmse = computeRMSE(currentResult.rankings, newResult.rankings);

    // Count rank order changes
    const currentOrder = Array.from(currentResult.rankings.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([ chore ]) => chore);
    const newOrder = Array.from(newResult.rankings.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([ chore ]) => chore);

    let rankChanges = 0;
    currentOrder.forEach((chore, i) => {
      const newIdx = newOrder.indexOf(chore);
      if (newIdx !== i) rankChanges++;
    });

    const spreadChange = ((newSpread.ratio - currentSpread.ratio) / currentSpread.ratio * 100);
    const spreadChangeStr = spreadChange >= 0 ? `+${spreadChange.toFixed(1)}%` : `${spreadChange.toFixed(1)}%`;

    const alphaStr = alpha.toFixed(2).padEnd(8);
    const dampStr = newResult.damping.toFixed(3).padStart(10);
    const spreadStr = newSpread.ratio.toFixed(2).padStart(9) + 'x';
    const rmseStr = rmse.toFixed(5).padStart(10);
    console.log(`  ${alphaStr} ${dampStr} ${spreadStr} ${rmseStr} ${spreadChangeStr.padStart(10)}`);

    results.push({
      alpha,
      damping: newResult.damping,
      spread: newSpread.ratio,
      rmse,
      spreadChange,
      rankChanges,
      rankings: newResult.rankings,
    });
  });

  console.log(`  ${'─'.repeat(80)}`);

  return { currentResult, currentSpread, results, numItems, preferences, maxPairs };
}

// ============================================================================
// MAIN
// ============================================================================

console.log('╔════════════════════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                           SIGMOID DAMPING ANALYSIS                                             ║');
console.log('║  CURRENT: implicit prefs + unidirectional explicit + d=0.99                                    ║');
console.log('║  NEW: no implicit + scaled unidirectional + d = 1/(1+exp(-a×coverage))                         ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════════════════════╝');

const ALPHA_VALUES = [ 0.5, 0.7, 1.0, 1.2, 1.5, 2.0, 3.0, 4.0 ];

const sageResults = analyzeDataset(
  'SAGE (9 residents, 28 chores)',
  path.join(__dirname, 'prefs-sage-9.csv'),
  9,
  ALPHA_VALUES,
);

const solegriaResults = analyzeDataset(
  'SOLEGRIA (5 residents, 72 chores)',
  path.join(__dirname, 'prefs-solegria-5.csv'),
  5,
  ALPHA_VALUES,
);

// Summary
console.log(`\n${'═'.repeat(80)}`);
console.log('  SUMMARY & RECOMMENDATIONS');
console.log('═'.repeat(80));

console.log('\n  Cross-house comparison by α:');
console.log(`\n  ${'α'.padEnd(6)} ${'Sage Δ'.padStart(10)} ${'Sol Δ'.padStart(10)} ${'Sage RMSE'.padStart(12)} ${'Sol RMSE'.padStart(12)}`);
console.log(`  ${'─'.repeat(52)}`);

ALPHA_VALUES.forEach((alpha) => {
  const sageR = sageResults.results.find(r => r.alpha === alpha);
  const solR = solegriaResults.results.find(r => r.alpha === alpha);

  if (sageR && solR) {
    const sageSpread = sageR.spreadChange >= 0
      ? `+${sageR.spreadChange.toFixed(1)}%`
      : `${sageR.spreadChange.toFixed(1)}%`;
    const solSpread = solR.spreadChange >= 0
      ? `+${solR.spreadChange.toFixed(1)}%`
      : `${solR.spreadChange.toFixed(1)}%`;
    const sageRmse = sageR.rmse.toFixed(5).padStart(12);
    const solRmse = solR.rmse.toFixed(5).padStart(12);
    console.log(`  ${alpha.toFixed(2).padEnd(6)} ${sageSpread.padStart(10)} ${solSpread.padStart(10)} ${sageRmse} ${solRmse}`);
  }
});

console.log('\n  Key observations:');
const sagePrefs = sageResults.preferences.length;
const solPrefs = solegriaResults.preferences.length;
const sageCoverage = (sagePrefs / sageResults.maxPairs * 100).toFixed(1);
const solCoverage = (solPrefs / solegriaResults.maxPairs * 100).toFixed(1);
console.log(`    - Sage: ${sagePrefs} prefs / ${sageResults.maxPairs} maxPairs = ${sageCoverage}% coverage`);
console.log(`    - Solegria: ${solPrefs} prefs / ${solegriaResults.maxPairs} maxPairs = ${solCoverage}% coverage`);
console.log('    - Simple formula uses total prefs directly, no participation penalty');

// Show side-by-side comparison across all alpha values
function showSideBySide (name, csvPath, numResidents, alphaValues, currentResult) {
  const preferences = parseCSV(csvPath);
  const chores = getUniqueChores(preferences);

  const prefs = preferences.map(p => ({
    target: p.alphaChore,
    source: p.betaChore,
    value: p.preference,
    residentId: p.residentId,
  }));

  // Get rankings for each alpha
  const rankingsByAlpha = {};
  alphaValues.forEach((alpha) => {
    const newRanker = new NewPowerRanker({ items: chores });
    newRanker.addPreferences(prefs);
    rankingsByAlpha[alpha] = newRanker.run(alpha).rankings;
  });

  // Sort chores by current ranking
  const sortedChores = Array.from(currentResult.rankings.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([ chore ]) => chore);

  console.log(`\n${'═'.repeat(120)}`);
  console.log(`  ${name} - SIDE BY SIDE COMPARISON`);
  console.log('═'.repeat(120));

  // Header
  const alphaHeaders = alphaValues.map(a => `α=${a}`).join('  ');
  console.log(`\n  ${'Chore'.padEnd(38)} ${'Current'.padStart(8)}  ${alphaHeaders}`);
  console.log(`  ${'─'.repeat(115)}`);

  sortedChores.forEach((chore) => {
    const current = (currentResult.rankings.get(chore) * 100).toFixed(2);
    const newValues = alphaValues.map((alpha) => {
      const val = (rankingsByAlpha[alpha].get(chore) * 100).toFixed(2);
      return val.padStart(6);
    }).join('  ');
    console.log(`  ${chore.slice(0, 37).padEnd(38)} ${current.padStart(7)}%  ${newValues}`);
  });

  // Summary row
  console.log(`  ${'─'.repeat(115)}`);
  const currentSpread = computeSpread(currentResult.rankings);
  const spreads = alphaValues.map((alpha) => {
    const spread = computeSpread(rankingsByAlpha[alpha]);
    return `${spread.ratio.toFixed(1)}x`.padStart(6);
  }).join('  ');
  console.log(`  ${'SPREAD (max/min)'.padEnd(38)} ${currentSpread.ratio.toFixed(1).padStart(6)}x  ${spreads}`);
}

const DISPLAY_ALPHAS = [ 0.25, 0.5, 0.75, 1.0, 1.5, 2.0 ];

showSideBySide(
  'SAGE',
  path.join(__dirname, 'prefs-sage-9.csv'),
  9,
  DISPLAY_ALPHAS,
  sageResults.currentResult,
);

showSideBySide(
  'SOLEGRIA',
  path.join(__dirname, 'prefs-solegria-5.csv'),
  5,
  DISPLAY_ALPHAS,
  solegriaResults.currentResult,
);
