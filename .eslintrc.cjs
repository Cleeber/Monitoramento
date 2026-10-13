module.exports = {
  root: true,
  env: { es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: [
    'node_modules/', 'dist/', 'client-dist/', 'build/', 'coverage/',
    'src/lib/database.types.ts',
  ],
  rules: {
    // Legacy integrations and dynamic API payloads still use explicit any.
    // Strict TypeScript checks remain enabled in the application's tsconfigs.
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-empty-interface': ['error', { allowSingleExtends: true }],
    // Express Request augmentation uses ambient namespaces, not runtime namespaces.
    '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_',
      // Destructuring deliberately omits secrets from API responses.
      ignoreRestSiblings: true,
    }],
  },
  overrides: [
    {
      files: ['client/**/*.{ts,tsx}'],
      env: { browser: true, node: false },
      extends: ['plugin:react-hooks/recommended'],
    },
  ],
}
