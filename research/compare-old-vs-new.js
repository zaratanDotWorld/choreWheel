/**
 * Side-by-side comparison: Current production rankings vs New rankings
 * Current: implicit prefs + scaled unidirectional + d=0.99
 * New: no implicit prefs + scaled unidirectional + sigmoid damping (a=0.5)
 */

const fs = require('fs');
const path = require('path');
const linAlg = require('linear-algebra')();

// ============================================================================
// CURRENT PRODUCTION IMPLEMENTATION
// Uses implicit preferences + scaled unidirectional explicit + d=0.99
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
    matrix = matrix.plusEach(1).minus(linAlg.Matrix.identity(n))
      .mulEach(numResidents).mulEach(implicitPref);
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
// No implicit preferences, scaled unidirectional, sigmoid damping
// Formula: d = 1 / (1 + exp(-a × P / maxPairs))
// ============================================================================
class NewPowerRanker {
  constructor ({ items }) {
    this.items = Array.from(items).sort((a, b) => a.localeCompare(b));
    this.numPreferences = 0;
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

      // Scaled unidirectional: 0.5 is neutral, only winner gains
      const scaled = (p.value - 0.5) * 2;

      if (scaled > 0) {
        matrix.data[sourceIx][targetIx] += scaled;
      } else if (scaled < 0) {
        matrix.data[targetIx][sourceIx] += Math.abs(scaled);
      }

      this.numPreferences++;
    });

    // Update diagonals
    this.#sumColumns(matrix).forEach((sum, ix) => { matrix.data[ix][ix] = sum; });
  }

  // Sigmoid damping: d = 1 / (1 + exp(-a × coverage))
  _computeDamping (a) {
    const n = this.items.length;
    const maxPairs = n * (n - 1) / 2;
    const coverage = this.numPreferences / maxPairs;
    return 1 / (1 + Math.exp(-a * coverage));
  }

  run (a = 0.5) {
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

    const maxPairs = n * (n - 1) / 2;
    const coverage = this.numPreferences / maxPairs;
    return { rankings: itemMap, damping: d, coverage };
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

function analyzeDataset (name, csvPath, numResidents, a) {
  const preferences = parseCSV(csvPath);
  const chores = getUniqueChores(preferences);
  const numItems = chores.size;
  const maxPairs = numItems * (numItems - 1) / 2;

  // Current implementation
  const currentRanker = new CurrentPowerRanker({ items: chores, numResidents });
  currentRanker.addPreferences(preferences.map(p => ({
    target: p.alphaChore,
    source: p.betaChore,
    value: p.preference,
  })));
  const currentResult = currentRanker.run();

  // New implementation
  const newRanker = new NewPowerRanker({ items: chores });
  newRanker.addPreferences(preferences.map(p => ({
    target: p.alphaChore,
    source: p.betaChore,
    value: p.preference,
  })));
  const newResult = newRanker.run(a);

  console.log(`\n${'='.repeat(100)}`);
  console.log(`${name}`);
  console.log('='.repeat(100));

  console.log(`\nItems: ${numItems}  |  Preferences: ${preferences.length}  |  ` +
              `maxPairs: ${maxPairs}  |  Coverage: ${(newResult.coverage * 100).toFixed(1)}%`);
  console.log(`\nCurrent damping: d = ${currentResult.damping.toFixed(3)} (fixed)`);
  console.log(`New damping (a=${a}): d = ${newResult.damping.toFixed(3)} (sigmoid)`);

  // Sort by current ranking
  const sortedChores = Array.from(currentResult.rankings.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([ chore, rank ]) => ({
      chore,
      currentRank: rank,
      newRank: newResult.rankings.get(chore),
    }));

  // Compute changes
  sortedChores.forEach((item) => {
    item.currentPct = item.currentRank * 100;
    item.newPct = item.newRank * 100;
    item.change = item.newPct - item.currentPct;
    item.changePct = ((item.newPct - item.currentPct) / item.currentPct * 100);
  });

  const uniform = 100 / numItems;

  console.log(`\n${'─'.repeat(100)}`);
  console.log('FULL CHORE PRIORITY LIST (sorted by current ranking)');
  console.log('─'.repeat(100));
  console.log(`${'#'.padStart(3)} ${'Chore'.padEnd(45)} ${'Current'.padStart(9)} ` +
              `${'New'.padStart(9)} ${'Change'.padStart(9)} ${'Δ%'.padStart(8)}`);
  console.log('─'.repeat(100));

  sortedChores.forEach((item, i) => {
    const changeStr = item.change >= 0 ? `+${item.change.toFixed(2)}` : item.change.toFixed(2);
    const changePctStr = item.changePct >= 0
      ? `+${item.changePct.toFixed(0)}%`
      : `${item.changePct.toFixed(0)}%`;
    const rank = String(i + 1).padStart(3);
    const choreName = item.chore.slice(0, 44).padEnd(45);
    const curPct = item.currentPct.toFixed(2).padStart(8);
    const newPct = item.newPct.toFixed(2).padStart(8);
    console.log(`${rank} ${choreName} ${curPct}% ${newPct}% ` +
                `${changeStr.padStart(8)}% ${changePctStr.padStart(7)}`);
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

  console.log('\n' + '─'.repeat(100));
  console.log('SUMMARY');
  console.log('─'.repeat(100));
  console.log(`Uniform baseline: ${uniform.toFixed(2)}%`);
  const curRatio = (currentSpread.max / currentSpread.min).toFixed(2);
  const newRatio = (newSpread.max / newSpread.min).toFixed(2);
  console.log(`\nCurrent:  ${currentSpread.min.toFixed(2)}% - ` +
              `${currentSpread.max.toFixed(2)}%  (${curRatio}x spread)`);
  console.log(`New:      ${newSpread.min.toFixed(2)}% - ` +
              `${newSpread.max.toFixed(2)}%  (${newRatio}x spread)`);
  console.log(`\nSpread change: ${curRatio}x → ${newRatio}x ` +
              `(${((newRatio / curRatio - 1) * 100).toFixed(1)}%)`);

  // Biggest changes
  const sortedByChange = [ ...sortedChores ].sort((a, b) =>
    Math.abs(b.change) - Math.abs(a.change));
  console.log('\nBiggest priority changes:');
  sortedByChange.slice(0, 5).forEach((item) => {
    const dir = item.change > 0 ? '↑' : '↓';
    const sign = item.change >= 0 ? '+' : '';
    const name = item.chore.slice(0, 38).padEnd(39);
    const cur = item.currentPct.toFixed(2);
    const nw = item.newPct.toFixed(2);
    console.log(`  ${dir} ${name} ${cur}% → ${nw}% (${sign}${item.change.toFixed(2)}%)`);
  });

  // Rank order changes
  const currentOrder = sortedChores.map(c => c.chore);
  const newOrder = [ ...sortedChores ].sort((a, b) => b.newPct - a.newPct).map(c => c.chore);

  let rankChanges = 0;
  const positionChanges = [];
  currentOrder.forEach((chore, i) => {
    const newIdx = newOrder.indexOf(chore);
    if (newIdx !== i) {
      rankChanges++;
      positionChanges.push({ chore, from: i + 1, to: newIdx + 1, delta: i - newIdx });
    }
  });

  console.log(`\nRank order changes: ${rankChanges}/${numItems} chores changed position`);

  if (positionChanges.length > 0) {
    const biggestMoves = positionChanges.sort((a, b) =>
      Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5);
    console.log('Biggest rank moves:');
    biggestMoves.forEach((m) => {
      const dir = m.delta > 0 ? '↑' : '↓';
      const name = m.chore.slice(0, 38).padEnd(39);
      console.log(`  ${dir} ${name} #${m.from} → #${m.to} (${m.delta > 0 ? '+' : ''}${m.delta})`);
    });
  }

  return { sortedChores, currentResult, newResult };
}

// Main
const A = 0.5;

console.log('╔════════════════════════════════════════════════════════════════════' +
            '══════════════════════════════╗');
console.log('║                        CURRENT vs NEW RANKINGS COMPARISON          ' +
            '                              ║');
console.log('║  Current: implicit prefs + scaled unidirectional + d=0.99          ' +
            '                              ║');
console.log('║  New: no implicit prefs + scaled unidirectional + sigmoid (a=' +
            A.toFixed(1) + ')                              ║');
console.log('╚════════════════════════════════════════════════════════════════════' +
            '══════════════════════════════╝');

analyzeDataset(
  'SAGE (9 residents, 23 chores)',
  path.join(__dirname, 'prefs-sage-9.csv'),
  9,
  A,
);

analyzeDataset(
  'SOLEGRIA (5 residents, 34 chores)',
  path.join(__dirname, 'prefs-solegria-5.csv'),
  5,
  A,
);
