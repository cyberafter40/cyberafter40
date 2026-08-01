/**
 * UI test suite.
 *
 * Kept separate from the domain suite (`jest.config` in package.json) for the
 * same reason the emulator suite is separate from the backend unit suite: the
 * domain tests must stay runnable with nothing installed but TypeScript, while
 * these need the whole React Native toolchain.
 *
 * Run with `npm run test:ui`.
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/__tests__/ui/**/*.test.tsx'],
  setupFilesAfterEnv: [
    // Registers RNTL's built-in matchers (toBeDisabled, toBeSelected,
    // toHaveAccessibilityValue …). It supersedes the deprecated jest-native.
    '@testing-library/react-native/extend-expect',
    '<rootDir>/__tests__/ui/setup.tsx',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|firebase|@firebase/.*))',
  ],
  collectCoverageFrom: [
    'src/ui/**/*.tsx',
    'src/screens/**/*.tsx',
    'src/games/**/*.tsx',
  ],
};
