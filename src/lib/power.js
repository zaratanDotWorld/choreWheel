const assert = require('assert');
const linAlg = require('linear-algebra')();

class PowerRanker {
  items; // Set(str)
  options; // Object
  matrix; // linAlg.Matrix
  numPreferences; // int

  /// @notice Construct an instance of a PowerRanker
  /// @param items:Set(str) The items being decided
  /// @param options:Object The additional options
  constructor ({ items, options = {} }) {
    assert(items.size >= 2, 'PowerRanker: Cannot rank less than two items');

    this.items = this.#sort(items);
    this.options = options;
    this.numPreferences = 0;

    this.matrix = this._prepareMatrix();

    this.log('Matrix initialized');
  }

  log (msg) {
    /* istanbul ignore next */
    if (this.options.verbose) { console.log(msg); }
  }

  /// @notice Add preferences to the matrix
  /// @dev We assume max one submission per participant/pair
  /// @dev Complexity is O(n)
  /// @param preferences:Array[{target:str, source:str, value:float}] The preferences of the participants
  addPreferences (preferences) { // [{ target, source, value }]
    const matrix = this.matrix;
    const itemMap = this.#toItemMap(this.items);

    // Add bidirectional preferences to the off-diagonals
    // Each preference allocates p.value toward target and (1 - p.value) toward source
    preferences.forEach((p) => {
      const targetIx = itemMap.get(p.target);
      const sourceIx = itemMap.get(p.source);

      // Bidirectional: allocate p.value toward target, (1-p.value) toward source
      matrix.data[sourceIx][targetIx] += p.value;
      matrix.data[targetIx][sourceIx] += (1 - p.value);

      this.numPreferences++;
    });

    // Add the diagonals (sums of columns)
    this.#sumColumns(matrix).map((sum, ix) => matrix.data[ix][ix] = sum); // eslint-disable-line no-return-assign
  }

  /// @notice Run the algorithm and return the results
  /// @param d:float The damping factor (optional, computed from data if not provided)
  /// @param epsilon:float The precision at which to run the algorithm
  /// @param nIter:int The maximum number of iterations to run the algorithm
  /// @return rankings:Map(int => float) The rankings, with item mapped to result
  run ({ d = null, epsilon = 0.001, nIter = 1000 } = {}) {
    // Compute damping from data size if not provided
    const damping = d !== null ? d : this._computeDamping();
    const weights = this._powerMethod(this.matrix, damping, epsilon, nIter);
    return this._applyLabels(weights);
  }

  /// @notice Generate the Beta variance per pair
  /// @dev Complexity is O(n^2)
  /// @return Array[{alpha:str, beta:str, variance:float}] The variances
  getVariances () {
    const variances = [];

    this.items.forEach((alpha, i) => {
      this.items.forEach((beta, j) => {
        if (i < j) {
          const variance = this._getVariance(i, j);
          variances.push({ alpha, beta, variance });
        }
      });
    });

    return variances;
  }

  // Internal

  // Complexity is O(n)
  _applyLabels (eigenvector) {
    const itemMap = this.#toItemMap(this.items);
    assert(itemMap.size === eigenvector.length, 'Mismatched arguments!');

    itemMap.forEach((ix, item) => itemMap.set(item, eigenvector[ix]));
    return itemMap;
  }

  // Complexity is O(1)
  _prepareMatrix () {
    const n = this.items.length;

    // Initialize the zero matrix (no implicit preferences)
    return linAlg.Matrix.zero(n, n);
  }

  /// @notice Compute damping factor based on data size
  /// @dev Formula: d = P / (P + 0.5 * maxPairs), bounded by [0.05, 0.99]
  /// @dev The 0.5 coefficient reflects that ranking differentiation comes from
  ///      the asymmetric component of preferences, not total preference weight
  /// @return d:float The computed damping factor
  _computeDamping () {
    const n = this.items.length;
    const maxPairs = n * (n - 1) / 2;
    const P = this.numPreferences;

    // Formula derived from empirical analysis: d = P / (P + 0.5 * maxPairs)
    // Bounded to ensure stability at extremes
    return Math.max(0.05, Math.min(0.99, P / (P + 0.5 * maxPairs)));
  }

  // Complexity is O(n^3)-ish
  _powerMethod (matrix, d, epsilon, nIter) {
    assert(matrix.rows === matrix.cols, 'Matrix must be square!');
    const n = matrix.rows;

    // Normalize matrix
    matrix = matrix.clone(); // Make a copy for safety
    matrix.data = matrix.data
      .map((row) => {
        const rowSum = this.#sum(row);
        // Handle zero-sum rows by using uniform distribution
        return rowSum > 0 ? row.map(x => x / rowSum) : row.map(() => 1 / n);
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

    this.log(`Eigenvector convergence after ${i} iterations`);
    return eigenvector.data[0];
  }

  // Complexity is O(1)
  _getVariance (i, j) {
    // Model as a Beta distribution with a (1, 1) prior
    const a = this.matrix.data[i][j] + 1;
    const b = this.matrix.data[j][i] + 1;

    return (a * b) /
      ((a + b + 1) * (a + b) ** 2);
  }

  // Private

  #toItemMap (items) { // [ id ]
    // ItemName -> MatrixIdx
    return new Map(items.map((item, ix) => [ item, ix ]));
  }

  #sort (items) {
    return Array.from(items).sort((a, b) => a - b);
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

module.exports = PowerRanker;
