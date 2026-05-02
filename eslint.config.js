const globals = require('globals');
const neostandard = require('neostandard');
const noOnlyTests = require('eslint-plugin-no-only-tests');

const OFF = 0;
const WARN = 1;
const ERROR = 2;

module.exports = [
  ...neostandard({ semi: true, noJsx: true }),
  {
    plugins: {
      'no-only-tests': noOnlyTests,
    },
    rules: {
      // Style overrides to preserve existing codebase formatting
      '@stylistic/array-bracket-spacing': [ ERROR, 'always' ],
      '@stylistic/arrow-parens': [ ERROR, 'as-needed', { requireForBlockBody: true } ],
      '@stylistic/comma-dangle': [ ERROR, 'always-multiline' ],
      '@stylistic/max-len': [ ERROR, 140 ],
      '@stylistic/no-extra-parens': [ ERROR, 'all', { conditionalAssign: false, nestedBinaryExpressions: false } ],
      '@stylistic/quote-props': [ ERROR, 'consistent' ],

      // Functional rules
      'no-unused-expressions': OFF,
      'no-unused-vars': [ ERROR, { vars: 'local' } ],
      'object-shorthand': [ WARN, 'properties' ],
      'eqeqeq': [ ERROR, 'always' ],
      'no-fallthrough': [ ERROR ],
      'no-bitwise': [ ERROR ],
      'no-only-tests/no-only-tests': [ ERROR, { fix: true } ],
      'camelcase': OFF,
    },
  },
  {
    files: [ 'test/**/*.{js,mjs}' ],
    languageOptions: {
      globals: globals.mocha,
    },
  },
  {
    ignores: [ 'migrations/**' ],
  },
];
