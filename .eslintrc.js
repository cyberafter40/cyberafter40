module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    // Hook rules catch stale-closure bugs — the exact class this project has
    // already been bitten by once (see useGameSession).
    'plugin:react-hooks/recommended',
  ],
  env: { es2022: true, node: true },
  globals: { __DEV__: 'readonly' },
  ignorePatterns: [
    'node_modules/',
    'functions/lib/',
    'functions/node_modules/',
    '.expo/',
    'dist/',
    'ios/',
    'android/',
  ],
  rules: {
    // `any` is used only at the registry boundary, where modules of mixed
    // generics have to live in one collection. Flag it, don't fail the build.
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    eqeqeq: ['error', 'smart'],
    'prefer-const': 'error',
  },
  overrides: [
    {
      files: ['__tests__/**/*.ts', '__tests__/**/*.tsx', 'functions/__tests__/**/*.ts'],
      env: { jest: true },
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        // jest.mock factories are hoisted above imports, so lazy `require`
        // inside them is the documented pattern, not an oversight.
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};
