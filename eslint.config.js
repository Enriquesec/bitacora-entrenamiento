import globals from 'globals';
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 2022,
      sourceType: 'commonjs',
    },
    rules: {
      'no-console': 'off',
      'prefer-const': 'error',
    },
  },
  {
    files: ['docs/js/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        Chart: 'readonly',
      },
      ecmaVersion: 2022,
      sourceType: 'script',
    },
    rules: {
      'no-console': 'warn',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
