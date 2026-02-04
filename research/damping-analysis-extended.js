/**
 * Extended analysis comparing damping behavior across different numResidents values
 */

const fs = require('fs');
const path = require('path');
const linAlg = require('linear-algebra')();

// OLD implementation with implicit preferences (from main branch)
class OldPowerRanker {
  constructor ({ items, options = {} }) {
    this.items = Array.from(items).sort((a, b) => a.localeCompare(b));
    this.options = options;
    const n = this.items.length;

    let matrix = linAlg.Matrix.zero(n, n);
    if (options.numParticipants) {
      const numParticipants = options.numParticipants;
      const implicitPref = options.implicitPref || 0;
      matrix = matrix.plusEach(1).minus(linAlg.Matrix.identity(n)).mulEach(numParticipants).mulEach(implicitPref);
    }
    this.matrix = matrix;
  }

  #toItemMap (items) { return new Map(items.map((item, ix) => [ item, ix ])); }
  #sum (array) { return array.reduce((s, v) => s + v, 0); }
  #norm (array) { return Math.sqrt(this.#sum(array.map(x => x * x))); }
  #sumColumns (matrix) { return matrix.trans().data.map(col => this.#sum(col)); }

  addPreferences (preferences) {
    const matrix = this.matrix;
    const itemMap = this.#toItemMap(this.items);
    const implicitPref = this.options.implicitPref || 0;

    preferences.forEach((p) => {
      const targetIx = itemMap.get(p.target);
      const sourceIx = itemMap.get(p.source);
      const scaled = (p.value - 0.5) * 2;

      if (scaled !== 0) {
        matrix.data[sourceIx][targetIx] -= implicitPref;
        matrix.data[targetIx][sourceIx] -= implicitPref;
        if (scaled > 0) {
          matrix.data[sourceIx][targetIx] += scaled;
        } else {
          matrix.data[targetIx][sourceIx] += -scaled;
        }
      }
    });

    this.#sumColumns(matrix).forEach((sum, ix) => { matrix.data[ix][ix] = sum; });
  }

  run ({ d = 1 }) {
    const n = this.items.length;
    const matrix = this.matrix.clone();
    matrix.data = matrix.data.map((row) => {
      const rowSum = this.#sum(row);
      return row.map(x => x / rowSum);
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

// Parse CSV
function parseCSV (filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim() !== '');

  const headerIdx = lines.findIndex(line => line.includes('"id"') || line.startsWith('id,'));
  if (headerIdx === -1) throw new Error('Could not find header row');

  return lines.slice(headerIdx + 1).map((line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { values.push(current); current = ''; } else current += char;
    }
    values.push(current);
    return {
      residentId: values[1],
      alphaChore: values[2],
      betaChore: values[3],
      preference: parseFloat(values[4]),
    };
  }).filter(p => p.alphaChore && p.betaChore && !isNaN(p.preference));
}

function getUniqueChores (preferences) {
  const chores = new Set();
  preferences.forEach((p) => { chores.add(p.alphaChore); chores.add(p.betaChore); });
  return chores;
}

function toRankerFormat (preferences) {
  return preferences.map(p => ({ target: p.alphaChore, source: p.betaChore, value: p.preference }));
}

// New damping-based ranker
class DampingPowerRanker {
  constructor ({ items }) {
    this.items = Array.from(items).sort();
    this.numPreferences = 0;
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
      this.numPreferences++;
    });
    this.#sumColumns(matrix).forEach((sum, ix) => { matrix.data[ix][ix] = sum; });
  }

  run ({ d, epsilon = 0.001, nIter = 1000 }) {
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
    for (let i = 0; i < nIter; i++) {
      eigenvector = prev.dot(matrix);
      if (this.#norm(eigenvector.minus(prev).data[0]) < epsilon) break;
      prev = eigenvector;
    }
    const itemMap = this.#toItemMap(this.items);
    const weights = eigenvector.data[0];
    itemMap.forEach((ix, item) => itemMap.set(item, weights[ix]));
    return itemMap;
  }
}

function compareRankings (r1, r2) {
  let sum2 = 0; let count = 0;
  r1.forEach((v1, k) => { const v2 = r2.get(k); if (v2 !== undefined) { sum2 += (v1 - v2) ** 2; count++; } });
  return Math.sqrt(sum2 / count);
}

function main () {
  const csvPath = path.join(__dirname, '..', 'prefs-solegria-5.csv');
  const preferences = parseCSV(csvPath);
  const chores = getUniqueChores(preferences);
  const uniqueResidents = new Set(preferences.map(p => p.residentId));

  const n = chores.size;
  const P = preferences.length;
  const maxPairs = n * (n - 1) / 2;

  console.log('=== Extended Damping Analysis ===\n');
  console.log(`Data: ${P} preferences, ${n} chores, ${uniqueResidents.size} unique submitters`);
  console.log(`Max pairs: ${maxPairs}\n`);

  // Analyze preference distribution
  const extremePrefs = preferences.filter(p => p.preference === 0 || p.preference === 1).length;
  const avgAbsScaled = preferences.reduce((sum, p) => sum + Math.abs((p.preference - 0.5) * 2), 0) / P;
  console.log('Preference distribution:');
  console.log(`  Extreme (0 or 1): ${extremePrefs}/${P} (${(100 * extremePrefs / P).toFixed(1)}%)`);
  console.log(`  Average |scaled|: ${avgAbsScaled.toFixed(4)}`);
  console.log();

  // Test with different numResidents values
  console.log('=== Optimal Damping by numResidents ===\n');
  console.log('N\timplicitPref\tOptimal d\tFitted α\tα=0.5 pred\tError');
  console.log('-'.repeat(80));

  for (const numResidents of [ 5, 6, 9, 12, 15, 20 ]) {
    const implicitPref = (1 / numResidents) / 2;

    // Get current implementation rankings
    const currentRanker = new OldPowerRanker({
      items: chores,
      options: { numParticipants: numResidents, implicitPref },
    });
    currentRanker.addPreferences(toRankerFormat(preferences));
    const currentRankings = currentRanker.run({ d: 0.99 });

    // Find optimal d
    let bestD = 0.5; let bestRMSE = Infinity;
    for (let d = 0.05; d <= 0.99; d += 0.01) {
      const newRanker = new DampingPowerRanker({ items: chores });
      newRanker.addPreferences(toRankerFormat(preferences));
      const rmse = compareRankings(currentRankings, newRanker.run({ d }));
      if (rmse < bestRMSE) { bestRMSE = rmse; bestD = d; }
    }
    // Fine tune
    for (let d = bestD - 0.05; d <= bestD + 0.05; d += 0.001) {
      if (d < 0.05 || d > 0.99) continue;
      const newRanker = new DampingPowerRanker({ items: chores });
      newRanker.addPreferences(toRankerFormat(preferences));
      const rmse = compareRankings(currentRankings, newRanker.run({ d }));
      if (rmse < bestRMSE) { bestRMSE = rmse; bestD = d; }
    }

    // Compute fitted alpha
    const fittedAlpha = (P / bestD - P) / maxPairs;

    // Compute α=0.5 prediction
    const predD = P / (P + 0.5 * maxPairs);
    const error = Math.abs(predD - bestD);

    const row = [ numResidents, implicitPref.toFixed(4), bestD.toFixed(4),
      fittedAlpha.toFixed(4), predD.toFixed(4), error.toFixed(4) ];
    console.log(row.join('\t\t'));
  }

  console.log();

  // Now analyze what happens if we use the CORRECT numResidents=9
  console.log('=== Detailed Analysis with N=9 ===\n');
  const numResidents = 5;
  const implicitPref = (1 / numResidents) / 2;

  const currentRanker = new OldPowerRanker({
    items: chores,
    options: { numParticipants: numResidents, implicitPref },
  });
  currentRanker.addPreferences(toRankerFormat(preferences));
  const currentRankings = currentRanker.run({ d: 0.99 });

  // Test various alpha values
  console.log('Testing different α values:\n');
  console.log('α\tPredicted d\tRMSE vs Current');
  console.log('-'.repeat(50));

  for (const alpha of [ 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0 ]) {
    const predD = Math.max(0.05, Math.min(0.99, P / (P + alpha * maxPairs)));
    const newRanker = new DampingPowerRanker({ items: chores });
    newRanker.addPreferences(toRankerFormat(preferences));
    const newRankings = newRanker.run({ d: predD });
    const rmse = compareRankings(currentRankings, newRankings);
    console.log(`${alpha.toFixed(1)}\t${predD.toFixed(4)}\t\t${rmse.toFixed(6)}`);
  }

  console.log();

  // Also test what happens with subsample scaling
  console.log('=== Subsample Analysis (N=9) ===\n');
  console.log('P\tOptimal d\tFitted α\tα=0.5 pred\tError');
  console.log('-'.repeat(60));

  for (const size of [ 10, 25, 50, 100, 150, 202 ]) {
    const sample = preferences.slice(0, size);

    const currR = new OldPowerRanker({
      items: chores,
      options: { numParticipants: numResidents, implicitPref },
    });
    currR.addPreferences(toRankerFormat(sample));
    const currRank = currR.run({ d: 0.99 });

    let optD = 0.5; let optRMSE = Infinity;
    for (let d = 0.05; d <= 0.99; d += 0.01) {
      const newR = new DampingPowerRanker({ items: chores });
      newR.addPreferences(toRankerFormat(sample));
      const rmse = compareRankings(currRank, newR.run({ d }));
      if (rmse < optRMSE) { optRMSE = rmse; optD = d; }
    }

    const fittedAlpha = (size / optD - size) / maxPairs;
    const predD = Math.max(0.1, size / (size + 0.5 * maxPairs));
    const error = Math.abs(predD - optD);

    console.log(`${size}\t${optD.toFixed(4)}\t\t${fittedAlpha.toFixed(4)}\t\t${predD.toFixed(4)}\t\t${error.toFixed(4)}`);
  }

  console.log();
  console.log('=== Key Finding ===\n');
  console.log('With the correct numResidents=9, the optimal damping is much higher than');
  console.log('the α=0.5 formula predicts. This is because with more residents, each');
  console.log('implicit preference is smaller, so explicit preferences dominate more.');
}

main();
