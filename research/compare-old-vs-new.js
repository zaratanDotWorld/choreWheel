/**
 * Side-by-side comparison: Current production rankings vs New (α=0.4) rankings
 */

const fs = require('fs');
const path = require('path');
const linAlg = require('linear-algebra')();

// ============================================================================
// CURRENT PRODUCTION IMPLEMENTATION
// Uses implicit preferences based on numResidents, data-dependent damping
// ============================================================================
class CurrentPowerRanker {
  constructor ({ items, numResidents }) {
    this.items = Array.from(items).sort((a, b) => a.localeCompare(b));
    this.numResidents = numResidents;
    this.numPreferences = 0;
    const n = this.items.length;

    // Initialize with implicit preferences
    const implicitPref = (1 / numResidents) / 2;
    let matrix = linAlg.Matrix.zero(n, n);
    // Add implicit preferences to off-diagonals
    matrix = matrix.plusEach(numResidents * implicitPref);
    // Remove from diagonal
    for (let i = 0; i < n; i++) {
      matrix.data[i][i] = 0;
    }
    this.matrix = matrix;
    this.implicitPref = implicitPref;
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

      // Bidirectional: allocate p.value toward target, (1-p.value) toward source
      matrix.data[sourceIx][targetIx] += p.value;
      matrix.data[targetIx][sourceIx] += (1 - p.value);
      this.numPreferences++;
    });

    // Update diagonals
    this.#sumColumns(matrix).forEach((sum, ix) => { matrix.data[ix][ix] = sum; });
  }

  // Current damping formula: d = P / (P + 0.5 * maxPairs)
  _computeDamping () {
    const n = this.items.length;
    const maxPairs = n * (n - 1) / 2;
    const P = this.numPreferences;
    return Math.max(0.05, Math.min(0.99, P / (P + 0.5 * maxPairs)));
  }

  run () {
    const d = this._computeDamping();
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
// No implicit preferences, QV-based effectiveP, α parameter
// Formula: effectiveP = Σ√prefs_i, d = effectiveP / (effectiveP + α × numItems)
// ============================================================================
class NewPowerRanker {
  constructor ({ items }) {
    this.items = Array.from(items).sort((a, b) => a.localeCompare(b));
    this.prefsByResident = {};
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

      // Bidirectional: allocate p.value toward target, (1-p.value) toward source
      matrix.data[sourceIx][targetIx] += p.value;
      matrix.data[targetIx][sourceIx] += (1 - p.value);

      // Track by resident for effectiveP calculation
      this.prefsByResident[p.residentId] = (this.prefsByResident[p.residentId] || 0) + 1;
    });

    // Update diagonals
    this.#sumColumns(matrix).forEach((sum, ix) => { matrix.data[ix][ix] = sum; });
  }

  // New damping formula: effectiveP = Σ√prefs_i, d = effectiveP / (effectiveP + α × n)
  _computeDamping (alpha) {
    const n = this.items.length;
    const effectiveP = Object.values(this.prefsByResident)
      .reduce((sum, count) => sum + Math.sqrt(count), 0);
    return Math.max(0.05, Math.min(0.99, effectiveP / (effectiveP + alpha * n)));
  }

  run (alpha = 0.4) {
    const d = this._computeDamping(alpha);
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

    const effectiveP = Object.values(this.prefsByResident)
      .reduce((sum, count) => sum + Math.sqrt(count), 0);
    return { rankings: itemMap, damping: d, effectiveP };
  }
}

// ============================================================================
// ANALYSIS
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

function analyzeDataset (name, csvPath, numResidents, alpha) {
  const preferences = parseCSV(csvPath);
  const chores = getUniqueChores(preferences);
  const numItems = chores.size;

  // Current implementation
  const currentRanker = new CurrentPowerRanker({ items: chores, numResidents });
  currentRanker.addPreferences(preferences.map(p => ({
    target: p.alphaChore,
    source: p.betaChore,
    value: p.preference,
    residentId: p.residentId,
  })));
  const currentResult = currentRanker.run();

  // New implementation
  const newRanker = new NewPowerRanker({ items: chores });
  newRanker.addPreferences(preferences.map(p => ({
    target: p.alphaChore,
    source: p.betaChore,
    value: p.preference,
    residentId: p.residentId,
  })));
  const newResult = newRanker.run(alpha);

  console.log(`\n${'='.repeat(90)}`);
  console.log(`${name}`);
  console.log('='.repeat(90));

  console.log(`\nItems: ${numItems}, Total prefs: ${preferences.length}, Residents: ${numResidents}`);
  console.log(`\nCurrent damping: d = ${currentResult.damping.toFixed(3)}`);
  console.log(`New damping (α=${alpha}): d = ${newResult.damping.toFixed(3)} (effectiveP = ${newResult.effectiveP.toFixed(1)})`);

  // Sort by current ranking
  const sortedChores = Array.from(currentResult.rankings.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([ chore, rank ]) => ({ chore, currentRank: rank, newRank: newResult.rankings.get(chore) }));

  // Compute changes
  sortedChores.forEach((item) => {
    item.currentPct = item.currentRank * 100;
    item.newPct = item.newRank * 100;
    item.change = item.newPct - item.currentPct;
    item.changePct = ((item.newPct - item.currentPct) / item.currentPct * 100);
  });

  const uniform = 100 / numItems;

  console.log(`\n${'─'.repeat(90)}`);
  console.log('SIDE-BY-SIDE COMPARISON (sorted by current ranking)');
  console.log('─'.repeat(90));
  console.log(`${'Chore'.padEnd(42)} ${'Current'.padStart(9)} ${'New'.padStart(9)} ${'Change'.padStart(9)} ${'Δ%'.padStart(8)}`);
  console.log('─'.repeat(90));

  sortedChores.forEach((item) => {
    const changeStr = item.change >= 0 ? `+${item.change.toFixed(2)}` : item.change.toFixed(2);
    const changePctStr = item.changePct >= 0 ? `+${item.changePct.toFixed(0)}%` : `${item.changePct.toFixed(0)}%`;
    const choreName = item.chore.slice(0, 41).padEnd(42);
    const curPct = item.currentPct.toFixed(2).padStart(8);
    const newPct = item.newPct.toFixed(2).padStart(8);
    console.log(`${choreName} ${curPct}% ${newPct}% ${changeStr.padStart(8)}% ${changePctStr.padStart(7)}`);
  });

  // Summary stats
  const currentSpread = {
    min: Math.min(...sortedChores.map(c => c.currentPct)),
    max: Math.max(...sortedChores.map(c => c.currentPct)),
  };
  const newSpread = {
    min: Math.min(...sortedChores.map(c => c.newPct)),
    max: Math.max(...sortedChores.map(c => c.newPct)),
  };

  console.log('\n' + '─'.repeat(90));
  console.log('SUMMARY');
  console.log('─'.repeat(90));
  console.log(`Uniform baseline: ${uniform.toFixed(2)}%`);
  const curRatio = (currentSpread.max / currentSpread.min).toFixed(1);
  const newRatio = (newSpread.max / newSpread.min).toFixed(1);
  console.log(`\nCurrent:  ${currentSpread.min.toFixed(2)}% - ${currentSpread.max.toFixed(2)}%  (${curRatio}x spread)`);
  console.log(`New:      ${newSpread.min.toFixed(2)}% - ${newSpread.max.toFixed(2)}%  (${newRatio}x spread)`);

  // Biggest changes
  const sortedByChange = [ ...sortedChores ].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  console.log('\nBiggest changes:');
  sortedByChange.slice(0, 5).forEach((item) => {
    const dir = item.change > 0 ? '↑' : '↓';
    const sign = item.change >= 0 ? '+' : '';
    const name = item.chore.slice(0, 35).padEnd(36);
    const cur = item.currentPct.toFixed(2);
    const nw = item.newPct.toFixed(2);
    console.log(`  ${dir} ${name} ${cur}% → ${nw}% (${sign}${item.change.toFixed(2)}%)`);
  });

  // Rank order changes
  const currentOrder = sortedChores.map(c => c.chore);
  const newOrder = [ ...sortedChores ].sort((a, b) => b.newPct - a.newPct).map(c => c.chore);

  let rankChanges = 0;
  currentOrder.forEach((chore, i) => {
    const newIdx = newOrder.indexOf(chore);
    if (Math.abs(newIdx - i) > 0) rankChanges++;
  });

  console.log(`\nRank order changes: ${rankChanges}/${numItems} chores changed position`);

  return { sortedChores, currentResult, newResult };
}

// Main
console.log('╔══════════════════════════════════════════════════════════════════════════════════════╗');
console.log('║         CURRENT vs NEW RANKINGS COMPARISON                                          ║');
console.log('║         Current: implicit prefs + data-dependent damping                            ║');
console.log('║         New: no implicit prefs + QV-based damping (α=0.4)                           ║');
console.log('╚══════════════════════════════════════════════════════════════════════════════════════╝');

const ALPHA = 0.4;

analyzeDataset(
  'SAGE (9 residents, 28 chores)',
  path.join(__dirname, 'prefs-sage-9.csv'),
  9,
  ALPHA,
);

analyzeDataset(
  'SOLEGRIA (5 residents, 72 chores)',
  path.join(__dirname, 'prefs-solegria-5.csv'),
  5,
  ALPHA,
);
