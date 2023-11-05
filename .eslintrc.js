const OFF = 0;
const WARN = 1;
const ERROR = 2;

module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    mocha: true,
    node: true,
  },
  extends: 'semistandard',
  overrides: [],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    'max-len': [ ERROR, 140 ],
    'no-unused-expressions': OFF,
    'no-unused-vars': [ ERROR, 'local' ],
    'object-shorthand': [ WARN, 'properties' ],
    'array-bracket-spacing': [ ERROR, 'always' ],
    'arrow-parens': [ ERROR, 'as-needed', { requireForBlockBody: true } ],
    'comma-dangle': [ ERROR, 'always-multiline' ],
    'eqeqeq': [ ERROR, 'always' ], // eslint-disable-line quote-props
    'no-fallthrough': [ ERROR ],
    'no-bitwise': [ ERROR ],
    'no-only-tests/no-only-tests': [ ERROR, { fix: true } ],
  },
  ignorePatterns: [
    'migrations',
  ],
  plugins: [
    'no-only-tests',
  ],
};
