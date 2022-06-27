const linAlg = require('linear-algebra')()

// O(preferences)
exports.convertPreferences = function convertPreferences(undirectedPreferences) { // [{alpha_id, beta_id, win_bit}]
  return undirectedPreferences.map(p => {
    let [source, target] = p.preference ? [p.alpha_chore, p.beta_chore] : [p.beta_chore, p.alpha_chore]
    return { source: source.toString(), target: target.toString()}
  })
}

// O(preferences)
exports.toMatrix = function toMatrix(directedPreferences) { // [{source, target}]
  const itemMap = toitemMap(directedPreferences)

  const n = itemMap.size
  const matrix = linAlg.Matrix.zero(n, n)

  // Calculate the off-diagonals
  directedPreferences.forEach(p => {
    let sourceIx = itemMap.get(p.source)
    let targetIx = itemMap.get(p.target)
    matrix.data[sourceIx][targetIx] += 1
  })

  // Add the diagonals (sums of columns)
  sumColumns(matrix).map((sum, ix) => matrix.data[ix][ix] = sum)
  return matrix
}

// O(identities^2 / 2)
exports.fromMatrix = function fromMatrix(preferenceMatrix) {
  if (preferenceMatrix.rows !== preferenceMatrix.cols) { throw new Error('Matrix must be square!'); }

  const n = preferenceMatrix.rows
  const array = []
  for (var i = 0; i < n; i++) {
    for (var j = 0; j < i; j++) {
      if (preferenceMatrix.data[i][j] > preferenceMatrix.data[j][i])
        array.push({'source': i, 'target': j})
      else if (preferenceMatrix.data[i][j] < preferenceMatrix.data[j][i])
        array.push({'source': j, 'target': i})
    }
  }
  return array
}

exports.applyLabels = function applyLabels(directedPreferences, eigenvector) {
  const itemMap = toitemMap(directedPreferences);
  if (itemMap.size !== eigenvector.length) { throw new Error('Mismatched arguments!'); }
  itemMap.forEach((ix, item) => itemMap.set(item, eigenvector[ix]));
  return itemMap
}

// O(n^3)-ish
exports.powerMethod = function powerMethod(matrix, d = 1, epsilon = 0.001, nIter = 1000, log = false) {
  if (matrix.rows !== matrix.cols) { throw new Error('Matrix must be square!'); }
  const n = matrix.rows

  // Normalize matrix
  matrix = matrix.mulEach(1) // Make copy
  matrix.data = matrix.data
    .map(row => {
      let rowSum = sum(row)
      return row.map(x => x / rowSum)
    })

  // Add damping factor
  matrix.mulEach_(d)
  matrix.plusEach_((1 - d) / n)

  // Initialize eigenvector to uniform distribution
  var eigenvector = linAlg.Vector.zero(n)
    .plusEach(1.0 / n)

  // Power method
  var prev = eigenvector
  for (var i = 0; i < nIter; i++) {
    eigenvector = prev.dot(matrix)
    if (norm(eigenvector.minus(prev).data[0]) < epsilon) break
    prev = eigenvector
  }

  if (log) { console.log(`Eigenvector convergence after ${i} iterations`); }
  return eigenvector.data[0]
}

// Internal

function toitemMap(directedPreferences) { // [{source, target}]
  const itemSet = toItemSet(directedPreferences)
  return new Map(
    Array.from(itemSet)
      .sort((a, b) => a - b) // Javascript is the worst
      .map((item, ix) => [item, ix]) // ItemName -> MatrixIdx
  )
}

function toItemSet(directedPreferences) { // [{source, target}]
  const itemArray = directedPreferences.flatMap(p => [p.source, p.target])
  return new Set(itemArray)
}

Array.prototype.flatMap = function(lambda) {
  return Array.prototype.concat.apply([], this.map(lambda))
}

function norm(array) {
return Math.sqrt(sum(array.map(x => x * x)))
}

function sum(array) {
return array.reduce((sumSoFar, val) => sumSoFar + val, 0)
}

function sumColumns(matrix) {
return matrix.trans().data.map(col => sum(col))
}
