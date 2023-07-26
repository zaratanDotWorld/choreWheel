const linAlg = require('linear-algebra')();

class PowerRanker {
  items; // Set(int)
  matrix; // linAlg.Matrix
  verbose; // bool

  /// @notice Construct an instance of a PowerRanker
  /// @param items:Set(int) The items being voted on
  /// @param preferences:Array[{alpha:int, beta:int, preference:float}] The preferences of the participants
  /// @param numResidents:int The number of participants
  /// @param implicitPref:float The implicif preference of a participant if not explicit
  constructor (items, preferences, numResidents, implicitPref, verbose = false) {
    if (items.size < 2) { throw new Error('PowerRanker: Cannot rank less than two items'); }

    this.items = items;
    this.matrix = this.toMatrix(this.items, preferences, numResidents, implicitPref);
    this.verbose = verbose;

    this.log('Matrix initialized');
  }

  log (msg) {
    /* istanbul ignore next */
    if (this.verbose) { console.log(msg); }
  }

  /// @notice Run the algorithm and return the results
  /// @param d:float The damping factor, 1 means no damping
  /// @param epsilon:float The precision at which to run the algorithm
  /// @param nIter:int The maximum number of iterations to run the algorithm
  /// @return rankings:Map(int => float) The rankings, with item mapped to result
  run (d = 1, epsilon = 0.001, nIter = 1000) {
    const weights = this.powerMethod(this.matrix, d, epsilon, nIter);
    return this.applyLabels(this.items, weights);
  }

  // O(items)
  applyLabels (items, eigenvector) {
    const itemMap = this.#toitemMap(items);
    if (itemMap.size !== eigenvector.length) { throw new Error('Mismatched arguments!'); }
    itemMap.forEach((ix, item) => itemMap.set(item, eigenvector[ix]));
    return itemMap;
  }

  // O(preferences)
  toMatrix (items, preferences, numResidents, implicitPref) { // [{ alpha, beta, preference }]
    const n = items.size;
    const itemMap = this.#toitemMap(items);

    // Initialise the zero matrix;
    let matrix = linAlg.Matrix.zero(n, n);

    // Add implicit neutral preferences, if any
    if (implicitPref > 0) {
      matrix = matrix
        .plusEach(1).minus(linAlg.Matrix.identity(n))
        .mulEach(implicitPref).mulEach(numResidents);
    }

    // Add the preferences to the off-diagonals, removing the implicit neutral preference
    // Recall that preference > 0.5 is flow towards, preference < 0.5 is flow away
    preferences.forEach(p => {
      const alphaIx = itemMap.get(p.alpha);
      const betaIx = itemMap.get(p.beta);
      matrix.data[betaIx][alphaIx] += p.preference - implicitPref;
      matrix.data[alphaIx][betaIx] += (1 - p.preference) - implicitPref;
    });

    // Add the diagonals (sums of columns)
    this.#sumColumns(matrix).map((sum, ix) => matrix.data[ix][ix] = sum); // eslint-disable-line no-return-assign
    return matrix;
  }

  // O(n^3)-ish
  powerMethod (matrix, d = 1, epsilon = 0.001, nIter = 1000) {
    if (matrix.rows !== matrix.cols) { throw new Error('Matrix must be square!'); }
    const n = matrix.rows;

    // Normalize matrix
    matrix = matrix.clone(); // Make a copy for safety
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

    this.log(`Eigenvector convergence after ${i} iterations`);
    return eigenvector.data[0];
  }

  // Internal

  #toitemMap (items) { // { id }
    return new Map(
      Array.from(items)
        .sort((a, b) => a - b) // Javascript is the worst
        .map((item, ix) => [ item, ix ]) // ItemName -> MatrixIdx
    );
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
