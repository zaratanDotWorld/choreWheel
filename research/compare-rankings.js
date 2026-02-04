/**
 * Compare chore rankings under current vs proposed implementations
 */

const fs = require('fs');
const path = require('path');
const linAlg = require('linear-algebra')();

// Current implementation (before changes)
class CurrentPowerRanker {
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

  run ({ d = 0.99 }) {
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

// New implementation with configurable alpha
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

      matrix.data[sourceIx][targetIx] += p.value;
      matrix.data[targetIx][sourceIx] += (1 - p.value);
      this.numPreferences++;
    });

    this.#sumColumns(matrix).forEach((sum, ix) => { matrix.data[ix][ix] = sum; });
  }

  run ({ alpha = 0.5 }) {
    const n = this.items.length;
    const maxPairs = n * (n - 1) / 2;
    const d = Math.max(0.05, Math.min(0.99, this.numPreferences / (this.numPreferences + alpha * maxPairs)));

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

// Parse CSV - handle empty lines and quotes properly
function parseCSV (filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim() !== '');

  // Find header line (starts with "id" or contains column names)
  const headerIdx = lines.findIndex(line => line.includes('"id"') || line.startsWith('id,'));
  if (headerIdx === -1) {
    throw new Error('Could not find header row');
  }

  const dataLines = lines.slice(headerIdx + 1);

  return dataLines.map((line) => {
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

function toRankerFormat (preferences) {
  return preferences.map(p => ({
    target: p.alphaChore,
    source: p.betaChore,
    value: p.preference,
  }));
}

function getUniqueChores (preferences) {
  const chores = new Set();
  preferences.forEach((p) => { chores.add(p.alphaChore); chores.add(p.betaChore); });
  return chores;
}

// Main
const csvPath = path.join(__dirname, '..', 'prefs-sage-9.csv');
const preferences = parseCSV(csvPath);
const chores = getUniqueChores(preferences);
const numResidents = 9;

console.log(`Preferences: ${preferences.length}, Chores: ${chores.size}, Residents: ${numResidents}\n`);

// Current implementation
const currentRanker = new CurrentPowerRanker({
  items: chores,
  options: { numParticipants: numResidents, implicitPref: (1 / numResidents) / 2 },
});
currentRanker.addPreferences(toRankerFormat(preferences));
const currentRankings = currentRanker.run({ d: 0.99 });

// New with alpha = 0.5
const newRanker05 = new NewPowerRanker({ items: chores });
newRanker05.addPreferences(toRankerFormat(preferences));
const { rankings: rankings05, damping: d05 } = newRanker05.run({ alpha: 0.5 });

// New with alpha = 1.0
const newRanker10 = new NewPowerRanker({ items: chores });
newRanker10.addPreferences(toRankerFormat(preferences));
const { rankings: rankings10, damping: d10 } = newRanker10.run({ alpha: 1.0 });

console.log(`Damping factors: α=0.5 → d=${d05.toFixed(4)}, α=1.0 → d=${d10.toFixed(4)}\n`);

// Build table
const sortedChores = Array.from(currentRankings.keys()).sort((a, b) =>
  currentRankings.get(b) - currentRankings.get(a),
);

console.log('| Chore | Current | α=0.5 | α=1.0 |');
console.log('|-------|---------|-------|-------|');

sortedChores.forEach((chore) => {
  const curr = (currentRankings.get(chore) * 100).toFixed(2);
  const new05 = (rankings05.get(chore) * 100).toFixed(2);
  const new10 = (rankings10.get(chore) * 100).toFixed(2);
  console.log(`| ${chore} | ${curr}% | ${new05}% | ${new10}% |`);
});
