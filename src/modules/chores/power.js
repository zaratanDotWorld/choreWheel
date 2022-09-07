const linAlg = require('linear-algebra')();

// O(preferences)
exports.convertPreferences = function (undirectedPreferences) { // [{alpha_id, beta_id, win_bit}]
  return undirectedPreferences.map(p => {
    const [ source, target ] = p.preference ? [ p.alpha_chore, p.beta_chore ] : [ p.beta_chore, p.alpha_chore ];
    return { source: source.toString(), target: target.toString() };
  });
};

// O(preferences)
exports.toMatrix = function (directedPreferences) { // [{source, target}]
  const itemMap = toitemMap(directedPreferences);

  const n = itemMap.size;
  const matrix = linAlg.Matrix.zero(n, n);

  // Calculate the off-diagonals
  directedPreferences.forEach(p => {
    const sourceIx = itemMap.get(p.source);
    const targetIx = itemMap.get(p.target);
    matrix.data[sourceIx][targetIx] += 1;
  });

  // Add the diagonals (sums of columns)
  sumColumns(matrix).map((sum, ix) => matrix.data[ix][ix] = sum); // eslint-disable-line no-return-assign
  return matrix;
};

// O(identities^2 / 2)
exports.fromMatrix = function (preferenceMatrix) {
  if (preferenceMatrix.rows !== preferenceMatrix.cols) { throw new Error('Matrix must be square!'); }

  const n = preferenceMatrix.rows;
  const array = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (preferenceMatrix.data[i][j] > preferenceMatrix.data[j][i]) {
        array.push({ source: i, target: j });
      } else if (preferenceMatrix.data[i][j] < preferenceMatrix.data[j][i]) {
        array.push({ source: j, target: i });
      }
    }
  }
  return array;
};

exports.applyLabels = function (directedPreferences, eigenvector) {
  const itemMap = toitemMap(directedPreferences);
  if (itemMap.size !== eigenvector.length) { throw new Error('Mismatched arguments!'); }
  itemMap.forEach((ix, item) => itemMap.set(item, eigenvector[ix]));
  return itemMap;
};

// O(n^3)-ish
exports.powerMethod = function (matrix, d = 1, epsilon = 0.001, nIter = 1000, log = false) {
  if (matrix.rows !== matrix.cols) { throw new Error('Matrix must be square!'); }
  const n = matrix.rows;

  // Normalize matrix
  matrix = matrix.mulEach(1); // Make copy
  matrix.data = matrix.data
    .map(row => {
      const rowSum = sum(row);
      return row.map(x => x / rowSum);
    });

  // Add damping factor
  matrix.mulEach_(d);
  matrix.plusEach_((1 - d) / n);

  // Initialize eigenvector to uniform distribution
  let eigenvector = linAlg.Vector.zero(n)
    .plusEach(1.0 / n);

  // Power method
  let prev = eigenvector;
  for (var i = 0; i < nIter; i++) { // eslint-disable-line no-var
    eigenvector = prev.dot(matrix);
    if (norm(eigenvector.minus(prev).data[0]) < epsilon) break;
    prev = eigenvector;
  }

  if (log) { console.log(`Eigenvector convergence after ${i} iterations`); }
  return eigenvector.data[0];
};

// Internal

function toitemMap (directedPreferences) { // [{source, target}]
  const itemSet = toItemSet(directedPreferences);
  return new Map(
    Array.from(itemSet)
      .sort((a, b) => a - b) // Javascript is the worst
      .map((item, ix) => [ item, ix ]) // ItemName -> MatrixIdx
  );
}

function toItemSet (directedPreferences) { // [{source, target}]
  const itemArray = directedPreferences.flatMap(p => [ p.source, p.target ]);
  return new Set(itemArray);
}

// eslint-disable-next-line no-extend-native
Array.prototype.flatMap = function (lambda) {
  return Array.prototype.concat.apply([], this.map(lambda));
};

function norm (array) {
  return Math.sqrt(sum(array.map(x => x * x)));
}

function sum (array) {
  return array.reduce((sumSoFar, val) => sumSoFar + val, 0);
}

function sumColumns (matrix) {
  return matrix.trans().data.map(col => sum(col));
}
