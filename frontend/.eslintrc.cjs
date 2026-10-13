module.exports = {
  root: true,
  env: { es2022: true, browser: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended'],
  ignorePatterns: ['node_modules/', 'dist/', 'coverage/'],
  rules: {
    // Existing dynamic API payloads still use any; strict TypeScript stays enabled.
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-empty-interface': ['error', { allowSingleExtends: true }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true }],
  },
  overrides: [{ files: ['vite.config.ts'], env: { node: true, browser: false } }],
}
