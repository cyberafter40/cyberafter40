/**
 * Emulator-backed test suite.
 *
 * Covers firestore.rules and the three Cloud Functions — the things that cannot
 * be unit tested because they only exist inside Firebase.
 *
 * Kept in its own config because these tests need running emulators, while the
 * default `npm test` suite deliberately needs nothing at all. Run via
 * `npm run test:emulator`, which starts and tears the emulators down around it.
 *
 * `rootDir` stays at `functions/` rather than the repo root so that Jest
 * resolves ts-jest from `functions/node_modules`. Rooting at the repo root works
 * locally — where the app's dependencies happen to be installed too — and fails
 * in CI, which installs only this package.
 */
module.exports = {
  testEnvironment: 'node',
  rootDir: __dirname,
  roots: ['<rootDir>/__tests__', '<rootDir>/src', '<rootDir>/../src'],
  testMatch: ['<rootDir>/__tests__/emulator/**/*.test.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/../src/$1' },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  // The emulator is shared state; parallel suites fighting over the same
  // documents produce flakes, not signal.
  maxWorkers: 1,
  testTimeout: 20_000,
};
