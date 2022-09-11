const linAlg = require('linear-algebra')();

// eslint-disable-next-line no-extend-native
Array.prototype.flatMap = function (lambda) {
  return Array.prototype.concat.apply([], this.map(lambda));
}; '';

class PowerRanker {
  directedPreferences;
  matrix;
  verbose;

  constructor (undirectedPreferences, verbose = false) {
    this.directedPreferences = this.convertPreferences(undirectedPreferences);
    this.matrix = this.toMatrix(this.directedPreferences);
    this.verbose = verbose;

    if (this.verbose) { console.log('Matrix initialized'); }
  }

  run (d = 1, epsilon = 0.001, nIter = 1000) {
    const weights = this.powerMethod(this.matrix, d, epsilon, nIter);
    return this.applyLabels(this.directedPreferences, weights);
  }

  // O(preferences)
  convertPreferences (undirectedPreferences) { // [{alpha_id, beta_id, win_bit}]
    return undirectedPreferences.map(p => {
      const [ source, target ] = p.preference ? [ p.alpha_chore, p.beta_chore ] : [ p.beta_chore, p.alpha_chore ];
      return { source: source.toString(), target: target.toString() };
    });
  }

  // O(preferences)
  toMatrix (directedPreferences) { // [{source, target}]
    const itemMap = this.#toitemMap(directedPreferences);

    const n = itemMap.size;
    const matrix = linAlg.Matrix.zero(n, n);

    // Calculate the off-diagonals
    directedPreferences.forEach(p => {
      const sourceIx = itemMap.get(p.source);
      const targetIx = itemMap.get(p.target);
      matrix.data[sourceIx][targetIx] += 1;
    });

    // Add the diagonals (sums of columns)
    this.#sumColumns(matrix).map((sum, ix) => matrix.data[ix][ix] = sum); // eslint-disable-line no-return-assign
    return matrix;
  }

  applyLabels (directedPreferences, eigenvector) {
    const itemMap = this.#toitemMap(directedPreferences);
    if (itemMap.size !== eigenvector.length) { throw new Error('Mismatched arguments!'); }
    itemMap.forEach((ix, item) => itemMap.set(item, eigenvector[ix]));
    return itemMap;
  }

  // O(n^3)-ish
  powerMethod (matrix, d = 1, epsilon = 0.001, nIter = 1000) {
    if (matrix.rows !== matrix.cols) { throw new Error('Matrix must be square!'); }
    const n = matrix.rows;

    // Normalize matrix
    matrix = matrix.mulEach(1); // Make copy
    matrix.data = matrix.data
      .map(row => {
        const rowSum = this.#sum(row);
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
      if (this.#norm(eigenvector.minus(prev).data[0]) < epsilon) break;
      prev = eigenvector;
    }

    if (this.verbose) { console.log(`Eigenvector convergence after ${i} iterations`); }
    return eigenvector.data[0];
  }

  // Internal

  #toitemMap (directedPreferences) { // [{source, target}]
    const itemSet = this.#toItemSet(directedPreferences);
    return new Map(
      Array.from(itemSet)
        .sort((a, b) => a - b) // Javascript is the worst
        .map((item, ix) => [ item, ix ]) // ItemName -> MatrixIdx
    );
  }

  #toItemSet (directedPreferences) { // [{source, target}]
    const itemArray = directedPreferences.flatMap(p => [ p.source, p.target ]);
    return new Set(itemArray);
  }

  #norm (array) {
    return Math.sqrt(this.#sum(array.map(x => x * x)));
  }

  #sum (array) {
    return array.reduce((sumSoFar, val) => sumSoFar + val, 0);
  }

  #sumColumns (matrix) {
    return matrix.trans().data.map(col => this.#sum(col));
  }
}

exports.PowerRanker = PowerRanker;
