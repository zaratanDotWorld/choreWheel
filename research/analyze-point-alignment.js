/**
 * Analyze whether current rankings compress the intended point distribution
 * and explore what damping factor better matches intended spread.
 */

const fs = require('fs');
const path = require('path');
const linAlg = require('linear-algebra')();

// OLD implementation with implicit preferences
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
      if (targetIx === undefined || sourceIx === undefined) return;
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

// NEW damping-based ranker
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

function parsePrefsCSV (filepath) {
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
      alphaChore: values[2],
      betaChore: values[3],
      preference: parseFloat(values[4]),
    };
  }).filter(p => p.alphaChore && p.betaChore && !isNaN(p.preference));
}

function parsePointsCSV (filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.trim().split('\n');
  const points = new Map();

  lines.slice(1).forEach((line) => {
    const match = line.match(/^([^,]+),(\d+)/);
    if (match) {
      points.set(match[1].trim(), parseInt(match[2]));
    }
  });

  return points;
}

function getUniqueChores (preferences) {
  const chores = new Set();
  preferences.forEach((p) => { chores.add(p.alphaChore); chores.add(p.betaChore); });
  return chores;
}

function toRankerFormat (preferences) {
  return preferences.map(p => ({ target: p.alphaChore, source: p.betaChore, value: p.preference }));
}

// Normalize a chore name for fuzzy matching
function normalizeChore (name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Try to match preference chores to point chores
function matchChores (prefChores, pointsMap) {
  const matches = new Map();
  const pointChores = Array.from(pointsMap.keys());

  for (const prefChore of prefChores) {
    const normPref = normalizeChore(prefChore);

    // Try exact match first
    if (pointsMap.has(prefChore)) {
      matches.set(prefChore, { pointChore: prefChore, points: pointsMap.get(prefChore) });
      continue;
    }

    // Try normalized fuzzy match
    let bestMatch = null;
    let bestScore = 0;

    for (const pointChore of pointChores) {
      const normPoint = normalizeChore(pointChore);

      // Check if one contains significant parts of the other
      const prefWords = normPref.split(' ').filter(w => w.length > 2);
      const pointWords = normPoint.split(' ').filter(w => w.length > 2);

      let matchingWords = 0;
      for (const pw of prefWords) {
        if (pointWords.some(ptw => ptw.includes(pw) || pw.includes(ptw))) {
          matchingWords++;
        }
      }

      const score = matchingWords / Math.max(prefWords.length, pointWords.length);
      if (score > bestScore && score > 0.3) {
        bestScore = score;
        bestMatch = pointChore;
      }
    }

    if (bestMatch) {
      matches.set(prefChore, { pointChore: bestMatch, points: pointsMap.get(bestMatch), score: bestScore });
    }
  }

  return matches;
}

function computeSpread (values) {
  const arr = Array.from(values);
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = Math.sqrt(arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length);
  return { min, max, ratio: max / min, std, cv: std / mean };
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
  const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length);
  sorted.forEach((item, rank) => { ranks[item.i] = rank + 1; });
  return ranks;
}

// Main
const prefsPath = path.join(__dirname, '..', 'prefs-solegria-5.csv');
const pointsPath = path.join(__dirname, '..', 'points-solegria-5.csv');

const preferences = parsePrefsCSV(prefsPath);
const pointsMap = parsePointsCSV(pointsPath);
const prefChores = getUniqueChores(preferences);

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║     Analyzing Ranking Compression vs Intended Points          ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log(`Preferences: ${preferences.length}`);
console.log(`Chores in preferences: ${prefChores.size}`);
console.log(`Chores in points file: ${pointsMap.size}`);

// Match chores between the two files
const matches = matchChores(prefChores, pointsMap);
console.log(`Matched chores: ${matches.size}\n`);

// Analyze intended points distribution
const matchedPoints = Array.from(matches.values()).map(m => m.points);
const pointSpread = computeSpread(matchedPoints);

console.log('=== Intended Points Distribution ===');
console.log(`Min: ${pointSpread.min}, Max: ${pointSpread.max}`);
console.log(`Ratio (max/min): ${pointSpread.ratio.toFixed(2)}x`);
console.log(`Coefficient of Variation: ${(pointSpread.cv * 100).toFixed(1)}%`);
console.log();

// Get rankings from current implementation (old with implicit prefs)
const numResidents = 5;
const implicitPref = (1 / numResidents) / 2;

const oldRanker = new OldPowerRanker({
  items: prefChores,
  options: { numParticipants: numResidents, implicitPref },
});
oldRanker.addPreferences(toRankerFormat(preferences));
const oldRankings = oldRanker.run({ d: 0.99 });

// Compute ranking spread for matched chores
const matchedOldRankings = [];
const matchedChoreNames = [];
for (const [ prefChore ] of matches) {
  if (oldRankings.has(prefChore)) {
    matchedOldRankings.push(oldRankings.get(prefChore));
    matchedChoreNames.push(prefChore);
  }
}

const oldSpread = computeSpread(matchedOldRankings);
console.log('=== Current Implementation Rankings (matched chores) ===');
console.log(`Min: ${(oldSpread.min * 100).toFixed(3)}%, Max: ${(oldSpread.max * 100).toFixed(3)}%`);
console.log(`Ratio (max/min): ${oldSpread.ratio.toFixed(2)}x`);
console.log(`Coefficient of Variation: ${(oldSpread.cv * 100).toFixed(1)}%`);
console.log();

// Compare spread compression
console.log('=== Spread Comparison ===');
console.log(`Intended ratio: ${pointSpread.ratio.toFixed(2)}x`);
console.log(`Current ratio:  ${oldSpread.ratio.toFixed(2)}x`);
console.log(`Compression:    ${(pointSpread.ratio / oldSpread.ratio).toFixed(2)}x`);
console.log();

// Compute correlation between intended points and current rankings
const pointsArr = matchedChoreNames.map(c => matches.get(c).points);
const rankingsArr = matchedChoreNames.map(c => oldRankings.get(c));
const correlation = spearmanCorrelation(pointsArr, rankingsArr);
console.log(`Spearman correlation (points vs rankings): ${correlation.toFixed(4)}`);
console.log();

// Test different damping values
console.log('=== Damping Factor Analysis ===');
console.log('Finding damping that best matches intended point spread...\n');
console.log('d\t\tRatio\t\tCV\t\tCorrelation');
console.log('-'.repeat(60));

const results = [];
for (let d = 0.5; d <= 0.99; d += 0.05) {
  const newRanker = new DampingPowerRanker({ items: prefChores });
  newRanker.addPreferences(toRankerFormat(preferences));
  const rankings = newRanker.run({ d });

  const matchedRankings = matchedChoreNames.map(c => rankings.get(c));
  const spread = computeSpread(matchedRankings);
  const corr = spearmanCorrelation(pointsArr, matchedRankings);

  results.push({ d, ratio: spread.ratio, cv: spread.cv, corr });
  console.log(`${d.toFixed(2)}\t\t${spread.ratio.toFixed(2)}x\t\t${(spread.cv * 100).toFixed(1)}%\t\t${corr.toFixed(4)}`);
}

// Find best match for spread ratio
const targetRatio = pointSpread.ratio;
let bestRatioMatch = results[0];
for (const r of results) {
  if (Math.abs(r.ratio - targetRatio) < Math.abs(bestRatioMatch.ratio - targetRatio)) {
    bestRatioMatch = r;
  }
}

console.log();
console.log('=== Optimal Damping for Intended Spread ===');
console.log(`Target ratio (from points): ${targetRatio.toFixed(2)}x`);
console.log(`Best matching d: ${bestRatioMatch.d.toFixed(2)} (ratio: ${bestRatioMatch.ratio.toFixed(2)}x)`);
console.log();

// Compare specific damping values
console.log('=== Side-by-Side Comparison ===\n');

const dampingValues = [
  { d: 0.52, label: 'α=0.5 (current PR)' },
  { d: 0.57, label: 'α=0.4 (adaptive)' },
  { d: bestRatioMatch.d, label: 'Spread-matched' },
  { d: 0.85, label: 'High damping' },
  { d: 0.95, label: 'Very high damping' },
];

// Dedupe
const seen = new Set();
const uniqueDamping = dampingValues.filter((v) => {
  const key = v.d.toFixed(2);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log('Chore'.padEnd(50) + 'Points\t' + uniqueDamping.map(v => `d=${v.d.toFixed(2)}`).join('\t'));
console.log('-'.repeat(50 + 8 + uniqueDamping.length * 8));

// Get rankings for each damping value
const allRankings = uniqueDamping.map((v) => {
  const ranker = new DampingPowerRanker({ items: prefChores });
  ranker.addPreferences(toRankerFormat(preferences));
  return ranker.run({ d: v.d });
});

// Sort by intended points descending
const sortedChores = matchedChoreNames
  .map(c => ({ chore: c, points: matches.get(c).points }))
  .sort((a, b) => b.points - a.points)
  .slice(0, 15); // Top 15

for (const { chore, points } of sortedChores) {
  const rankings = allRankings.map(r => (r.get(chore) * 100).toFixed(2) + '%');
  console.log(chore.substring(0, 48).padEnd(50) + points + '\t' + rankings.join('\t'));
}

console.log();
console.log('=== Key Insight ===');
console.log(`The intended points have a ${targetRatio.toFixed(1)}x spread (max/min).`);
console.log(`Current implementation (d≈0.59) produces a ${oldSpread.ratio.toFixed(1)}x spread.`);
if (oldSpread.ratio < targetRatio) {
  console.log('\nRankings ARE compressed relative to intended points.');
  console.log(`Higher damping (d≈${bestRatioMatch.d.toFixed(2)}) would better match the intended spread.`);
} else {
  console.log('\nRankings are NOT compressed - they match or exceed intended spread.');
}
