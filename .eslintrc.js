module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
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
      files: ['__tests__/**/*.ts'],
      env: { jest: true },
      rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
    },
  ],
};
