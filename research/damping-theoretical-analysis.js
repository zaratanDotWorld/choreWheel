/**
 * Theoretical analysis of the relationship between
 * implicit preferences and effective damping
 */

const fs = require('fs');
const path = require('path');
const linAlg = require('linear-algebra')();

const PowerRanker = require('../src/lib/power');

// Parse CSV
function parseCSV (filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.trim().split('\n');

  return lines.slice(1).map((line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { values.push(current); current = ''; } else current += char;
    }
    values.push(current);
    return {
      id: parseInt(values[0]),
      residentId: values[1],
      alphaChore: values[2],
      betaChore: values[3],
      preference: parseFloat(values[4]),
    };
  });
}

function getUniqueChores (preferences) {
  const chores = new Set();
  preferences.forEach((p) => { chores.add(p.alphaChore); chores.add(p.betaChore); });
  return chores;
}

function toRankerFormat (preferences) {
  return preferences.map(p => ({ target: p.alphaChore, source: p.betaChore, value: p.preference }));
}

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
  console.log('=== Theoretical Analysis ===\n');

  const csvPath = path.join(__dirname, '..', 'prefs-sage-9.csv');
  const preferences = parseCSV(csvPath);
  const chores = getUniqueChores(preferences);

  const n = chores.size;
  const P = preferences.length;
  const numResidents = 9; // Actual house has 9 residents
  const maxPairs = n * (n - 1) / 2;

  console.log(`Chores (n): ${n}`);
  console.log(`Preferences (P): ${P}`);
  console.log(`Residents (N): ${numResidents}`);
  console.log(`Max pairs: ${maxPairs}`);
  console.log();

  // Current implementation analysis
  console.log('=== Current Implementation Matrix Analysis ===\n');

  const implicitPref = (1 / numResidents) / 2;
  const implicitPerCell = numResidents * implicitPref;
  console.log(`implicitPref = (1/${numResidents})/2 = ${implicitPref.toFixed(6)}`);
  console.log(`Total implicit per cell = N * implicitPref = ${implicitPerCell.toFixed(4)}`);
  console.log();

  // In current implementation:
  // - Each off-diagonal starts at N * implicitPref = 0.5
  // - There are n*(n-1) off-diagonal cells
  // - Total implicit weight = n*(n-1) * 0.5
  const totalImplicit = n * (n - 1) * 0.5;
  console.log(`Total implicit weight in matrix: ${n} * ${n - 1} * 0.5 = ${totalImplicit}`);

  // Each explicit preference adds roughly 1 unit (after scaling)
  // Actually, let's compute exact explicit weight
  let totalExplicit = 0;
  preferences.forEach((p) => {
    const scaled = (p.preference - 0.5) * 2;
    totalExplicit += Math.abs(scaled);
  });
  console.log(`Total explicit weight: ${totalExplicit.toFixed(2)}`);
  console.log();

  // The ratio of explicit to total gives us insight into effective signal strength
  const explicitRatio = totalExplicit / (totalImplicit + totalExplicit);
  console.log(`Explicit / (Implicit + Explicit) = ${explicitRatio.toFixed(4)}`);
  console.log();

  // This ratio should relate to effective damping!
  // In damping model: ranking = d * M_explicit + (1-d) * uniform
  // In implicit model: ranking ≈ explicit_ratio * M_explicit + (1-explicit_ratio) * uniform

  console.log('=== Key Insight ===\n');
  console.log('The implicit preferences create a "dilution" effect similar to damping.');
  console.log('The effective damping is approximately:');
  console.log('  d_effective ≈ totalExplicit / (totalExplicit + totalImplicit)');
  console.log(`  d_effective ≈ ${totalExplicit.toFixed(2)} / (${totalExplicit.toFixed(2)} + ${totalImplicit.toFixed(2)})`);
  console.log(`  d_effective ≈ ${explicitRatio.toFixed(4)}`);
  console.log();

  // But this isn't quite right either - let's verify empirically
  console.log('=== Empirical Verification ===\n');

  const currentRanker = new PowerRanker({
    items: chores,
    options: { numParticipants: numResidents, implicitPref },
  });
  currentRanker.addPreferences(toRankerFormat(preferences));
  const currentRankings = currentRanker.run({ d: 0.99 });

  // Find best matching d
  let bestD = 0; let bestRMSE = Infinity;
  for (let d = 0.1; d <= 0.99; d += 0.01) {
    const newRanker = new DampingPowerRanker({ items: chores });
    newRanker.addPreferences(toRankerFormat(preferences));
    const newRankings = newRanker.run({ d });
    const rmse = compareRankings(currentRankings, newRankings);
    if (rmse < bestRMSE) { bestRMSE = rmse; bestD = d; }
  }
  // Fine tune
  for (let d = bestD - 0.05; d <= bestD + 0.05; d += 0.001) {
    if (d < 0.1 || d > 0.99) continue;
    const newRanker = new DampingPowerRanker({ items: chores });
    newRanker.addPreferences(toRankerFormat(preferences));
    const newRankings = newRanker.run({ d });
    const rmse = compareRankings(currentRankings, newRankings);
    if (rmse < bestRMSE) { bestRMSE = rmse; bestD = d; }
  }

  console.log(`Empirically optimal d: ${bestD.toFixed(4)}`);
  console.log(`Theoretical d (explicit ratio): ${explicitRatio.toFixed(4)}`);
  console.log();

  // The relationship seems to be:
  // d_effective ≈ P / (P + n*(n-1)*0.5 * N / (scaling_factor))
  // where scaling_factor accounts for the implicit subtraction

  // Actually, let's think about it differently:
  // - Each preference pair starts with 0.5 in both directions (total 1.0)
  // - An explicit pref replaces implicitPref (0.0833) with explicit value
  // - Net change per explicit pref is bounded by 1.0

  // Let's try: d = P / (P + alpha * maxPairs) for various alpha
  console.log('=== Formula Fitting ===\n');

  // We know bestD ≈ 0.525 for P=202, maxPairs=378
  // bestD = P / (P + alpha * maxPairs)
  // 0.525 = 202 / (202 + alpha * 378)
  // 0.525 * (202 + 378*alpha) = 202
  // 106.05 + 198.45*alpha = 202
  // 198.45*alpha = 95.95
  // alpha = 0.4835

  const alpha_fitted = (P / bestD - P) / maxPairs;
  console.log('Fitted alpha for d = P / (P + alpha * maxPairs):');
  console.log(`  alpha = ${alpha_fitted.toFixed(4)}`);
  console.log();

  // Verify
  const d_verify = P / (P + alpha_fitted * maxPairs);
  console.log(`Verification: d = ${P} / (${P} + ${alpha_fitted.toFixed(4)} * ${maxPairs}) = ${d_verify.toFixed(4)}`);
  console.log();

  // But alpha might depend on numResidents. Let's see...
  // In current impl, implicitPref = 1/(2N), total implicit = N * 1/(2N) = 0.5 per cell
  // So alpha ≈ 0.5 makes sense! (it's close to 0.4835)

  console.log('=== Proposed Formula ===\n');
  console.log('Based on analysis, a good formula is:');
  console.log('  d = P / (P + 0.5 * maxPairs)');
  console.log('  where maxPairs = n * (n - 1) / 2');
  console.log();

  const d_proposed = P / (P + 0.5 * maxPairs);
  console.log(`For this house: d = ${P} / (${P} + 0.5 * ${maxPairs}) = ${d_proposed.toFixed(4)}`);
  console.log(`Optimal d: ${bestD.toFixed(4)}`);
  console.log(`Difference: ${Math.abs(d_proposed - bestD).toFixed(4)}`);
  console.log();

  // Add d_min floor for stability
  console.log('With stability floor:');
  console.log('  d = max(0.1, P / (P + 0.5 * maxPairs))');
  console.log();

  // Test this formula against different subsamples
  console.log('=== Testing Proposed Formula Against Subsamples ===\n');
  console.log('P\tPredicted d\tOptimal d\tError');
  console.log('-'.repeat(50));

  const sampleSizes = [ 10, 25, 50, 100, 150, 202 ];
  for (const size of sampleSizes) {
    // Get optimal d for this size
    const sample = preferences.slice(0, size);
    const currentR = new PowerRanker({
      items: chores,
      options: { numParticipants: numResidents, implicitPref },
    });
    currentR.addPreferences(toRankerFormat(sample));
    const currRank = currentR.run({ d: 0.99 });

    let optD = 0.5; let optRMSE = Infinity;
    for (let d = 0.05; d <= 0.99; d += 0.01) {
      const newR = new DampingPowerRanker({ items: chores });
      newR.addPreferences(toRankerFormat(sample));
      const rmse = compareRankings(currRank, newR.run({ d }));
      if (rmse < optRMSE) { optRMSE = rmse; optD = d; }
    }

    const predD = Math.max(0.1, size / (size + 0.5 * maxPairs));
    console.log(`${size}\t${predD.toFixed(4)}\t\t${optD.toFixed(4)}\t\t${Math.abs(predD - optD).toFixed(4)}`);
  }

  console.log();
  console.log('=== Final Recommendation ===\n');
  console.log('The formula d = P / (P + 0.5 * maxPairs) provides a good approximation');
  console.log('to match the current implementation behavior across different data sizes.');
  console.log();
  console.log('For production use:');
  console.log('  const maxPairs = n * (n - 1) / 2;');
  console.log('  const d = Math.max(0.15, Math.min(0.95, P / (P + 0.5 * maxPairs)));');
  console.log();
  console.log('This removes the dependency on numResidents while preserving similar ranking behavior.');
}

main();
