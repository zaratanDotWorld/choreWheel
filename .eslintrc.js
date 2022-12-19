module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    mocha: true,
    node: true
  },
  extends: 'semistandard',
  overrides: [],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    'max-len': [ 2, 150 ],
    'no-unused-expressions': 0,
    'no-unused-vars': [ 2, 'local' ],
    'object-shorthand': [ 1, 'properties' ],
    'array-bracket-spacing': [ 2, 'always' ],
    'no-only-tests/no-only-tests': [ 2, { fix: true } ]
  },
  ignorePatterns: [
    'migrations'
  ],
  plugins: [
    'no-only-tests'
  ]
};
