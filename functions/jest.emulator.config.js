/**
 * Emulator-backed test suite.
 *
 * Covers firestore.rules and the submitGameResult write transaction — the two
 * things that cannot be unit tested because they only exist inside Firestore.
 *
 * Kept in its own config because these tests need a running emulator, while the
 * default `npm test` suite deliberately needs nothing at all. Run via
 * `npm run test:emulator`, which starts and tears the emulator down around it.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  testMatch: ['<rootDir>/functions/__tests__/emulator/**/*.test.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/functions/tsconfig.test.json' }],
  },
  // The emulator is single-threaded from our point of view; parallel suites
  // fighting over the same documents produce flakes, not signal.
  maxWorkers: 1,
  testTimeout: 20_000,
};
