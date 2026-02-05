/**
 * Analysis: How different α parameterizations affect actual chore rankings
 */

const fs = require('fs');
const path = require('path');

// Minimal PowerRanker implementation
class PowerRanker {
  constructor (items) {
    this.items = Array.from(items).sort();
    this.matrix = this._prepareMatrix();
  }

  _prepareMatrix () {
    const n = this.items.length;
    const data = [];
    for (let i = 0; i < n; i++) {
      data.push(new Array(n).fill(0));
    }
    return { rows: n, cols: n, data };
  }

  addPreferences (preferences) {
    const itemMap = new Map(this.items.map((item, ix) => [ item, ix ]));

    preferences.forEach((p) => {
      const targetIx = itemMap.get(p.target);
      const sourceIx = itemMap.get(p.source);
      if (targetIx === undefined || sourceIx === undefined) return;

      this.matrix.data[sourceIx][targetIx] += p.value;
      this.matrix.data[targetIx][sourceIx] += (1 - p.value);
    });

    // Add diagonals
    for (let i = 0; i < this.matrix.rows; i++) {
      let colSum = 0;
      for (let j = 0; j < this.matrix.rows; j++) {
        colSum += this.matrix.data[j][i];
      }
      this.matrix.data[i][i] = colSum;
    }
  }

  run (d) {
    const n = this.matrix.rows;
    let matrixData = this.matrix.data.map((row) => {
      const rowSum = row.reduce((a, b) => a + b, 0);
      return rowSum > 0 ? row.map(x => x / rowSum) : row.map(() => 1 / n);
    });

    // Apply damping
    matrixData = matrixData.map(row =>
      row.map(x => x * d + (1 - d) / n),
    );

    // Power method
    let eigenvector = new Array(n).fill(1 / n);
    for (let iter = 0; iter < 1000; iter++) {
      const newVec = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          newVec[i] += eigenvector[j] * matrixData[j][i];
        }
      }
      const diff = Math.sqrt(newVec.reduce((sum, v, i) => sum + (v - eigenvector[i]) ** 2, 0));
      eigenvector = newVec;
      if (diff < 0.0001) break;
    }

    return new Map(this.items.map((item, ix) => [ item, eigenvector[ix] ]));
  }
}

// Parse CSV
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

// Get unique chores
function getUniqueChores (preferences) {
  const chores = new Set();
  preferences.forEach((p) => {
    chores.add(p.alphaChore);
    chores.add(p.betaChore);
  });
  return chores;
}

// Get prefs by resident
function getPrefsByResident (preferences) {
  const counts = {};
  preferences.forEach((p) => {
    counts[p.residentId] = (counts[p.residentId] || 0) + 1;
  });
  return counts;
}

// Compute effectiveP
function computeEffectiveP (prefsByResident) {
  return Object.values(prefsByResident).reduce((sum, n) => sum + Math.sqrt(n), 0);
}

// Compute damping
function computeDamping (effectiveP, numItems, alpha) {
  const raw = effectiveP / (effectiveP + alpha * numItems);
  return Math.max(0.05, Math.min(0.99, raw));
}

// Compute spread metrics
function computeSpread (rankings) {
  const values = Array.from(rankings.values());
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const cv = Math.sqrt(variance) / mean;
  return { min, max, ratio: max / min, cv };
}

// Analyze dataset
function analyzeDataset (name, csvPath) {
  const preferences = parseCSV(csvPath);
  const chores = getUniqueChores(preferences);
  const prefsByResident = getPrefsByResident(preferences);

  const numItems = chores.size;
  const effectiveP = computeEffectiveP(prefsByResident);

  // Create ranker
  const ranker = new PowerRanker(chores);
  ranker.addPreferences(preferences.map(p => ({
    target: p.alphaChore,
    source: p.betaChore,
    value: p.preference,
  })));

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Dataset: ${name}`);
  console.log(`Items: ${numItems}, effectiveP: ${effectiveP.toFixed(1)}`);
  console.log('='.repeat(80));

  // Test different α values
  const alphas = [ 0.3, 0.4, 0.5, 0.7, 1.0 ];
  const allRankings = {};

  alphas.forEach((alpha) => {
    const d = computeDamping(effectiveP, numItems, alpha);
    const rankings = ranker.run(d);
    allRankings[alpha] = { d, rankings };
  });

  // Also compute with d=0.99 (near-pure preferences) for reference
  const pureRankings = ranker.run(0.99);
  allRankings.pure = { d: 0.99, rankings: pureRankings };

  // Show spread metrics
  console.log('\n--- Spread Metrics ---');
  console.log('α\t\td\t\tMin %\t\tMax %\t\tRatio\t\tCV');
  [ 'pure', ...alphas ].forEach((alpha) => {
    const { d, rankings } = allRankings[alpha];
    const spread = computeSpread(rankings);
    const label = alpha === 'pure' ? 'pure' : alpha.toFixed(1);
    const minPct = (spread.min * 100).toFixed(2);
    const maxPct = (spread.max * 100).toFixed(2);
    const cvPct = (spread.cv * 100).toFixed(1);
    console.log(`${label}\t\t${d.toFixed(3)}\t\t${minPct}\t\t${maxPct}\t\t${spread.ratio.toFixed(2)}x\t\t${cvPct}%`);
  });

  // Sort chores by pure ranking
  const sortedChores = Array.from(pureRankings.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([ chore ]) => chore);

  // Show top and bottom chores with rankings across α values
  console.log('\n--- Top 10 Chores (by pure preference ranking) ---');
  console.log('Chore'.padEnd(45) + [ 'pure', ...alphas ].map(a => (a === 'pure' ? 'pure' : `α=${a}`).padStart(8)).join(''));

  sortedChores.slice(0, 10).forEach((chore) => {
    const values = [ 'pure', ...alphas ].map((alpha) => {
      const pct = allRankings[alpha].rankings.get(chore) * 100;
      return pct.toFixed(2).padStart(8);
    }).join('');
    console.log(chore.slice(0, 44).padEnd(45) + values);
  });

  console.log('\n--- Bottom 10 Chores ---');
  sortedChores.slice(-10).forEach((chore) => {
    const values = [ 'pure', ...alphas ].map((alpha) => {
      const pct = allRankings[alpha].rankings.get(chore) * 100;
      return pct.toFixed(2).padStart(8);
    }).join('');
    console.log(chore.slice(0, 44).padEnd(45) + values);
  });

  // Show how rankings compress toward uniform
  const uniform = 100 / numItems;
  console.log(`\n--- Compression Analysis (uniform = ${uniform.toFixed(2)}%) ---`);
  console.log('α\t\td\t\tTop chore\tBottom chore\tSpread from uniform');
  [ 'pure', ...alphas ].forEach((alpha) => {
    const { d, rankings } = allRankings[alpha];
    const spread = computeSpread(rankings);
    const topDiff = (spread.max * 100 - uniform).toFixed(2);
    const botDiff = (uniform - spread.min * 100).toFixed(2);
    const label = alpha === 'pure' ? 'pure' : alpha.toFixed(1);
    const totalDiff = (parseFloat(topDiff) + parseFloat(botDiff)).toFixed(2);
    console.log(`${label}\t\t${d.toFixed(3)}\t\t+${topDiff}%\t\t-${botDiff}%\t\t${totalDiff}%`);
  });

  return { numItems, effectiveP, allRankings, sortedChores };
}

// Main
console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
console.log('║           Ranking Impact Analysis: How α Affects Chore Priorities           ║');
console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

const sageResults = analyzeDataset('Sage (28 chores, 6 active residents)', path.join(__dirname, 'prefs-sage-9.csv'));
const solegriaResults = analyzeDataset('Solegria (72 chores, 2 active residents)', path.join(__dirname, 'prefs-solegria-5.csv'));

// Summary comparison
console.log('\n' + '='.repeat(80));
console.log('SUMMARY: Recommended α and its effects');
console.log('='.repeat(80));

const recommendedAlpha = 0.4;
console.log(`\nWith α = ${recommendedAlpha}:`);

[ { name: 'Sage', results: sageResults }, { name: 'Solegria', results: solegriaResults } ].forEach(({ name, results }) => {
  const { d, rankings } = results.allRankings[recommendedAlpha];
  const spread = computeSpread(rankings);
  const uniform = 100 / results.numItems;

  console.log(`\n${name}:`);
  console.log(`  Damping: d = ${d.toFixed(3)}`);
  console.log(`  Range: ${(spread.min * 100).toFixed(2)}% - ${(spread.max * 100).toFixed(2)}% (uniform = ${uniform.toFixed(2)}%)`);
  console.log(`  Spread ratio: ${spread.ratio.toFixed(2)}x`);
  console.log(`  Top chore: ${results.sortedChores[0].slice(0, 40)}`);
  console.log(`  Bottom chore: ${results.sortedChores[results.sortedChores.length - 1].slice(0, 40)}`);
});
