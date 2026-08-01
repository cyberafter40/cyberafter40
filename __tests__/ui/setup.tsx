/**
 * Shared setup for the UI suite.
 *
 * The mock boundary is deliberately drawn at the *service* layer, never inside
 * the app's own logic: engines, scoring, progression, theming, navigation state
 * and the components themselves all run for real. Only the things that would
 * reach a device or the network are replaced — so a passing test means the real
 * code works, not that the mocks agree with each other.
 */

/* ---- Native modules with no JS implementation under Jest ---- */

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  // The mock omits `call`, which the layout-animation helpers touch.
  Reanimated.default.call = () => undefined;
  return Reanimated;
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        firebase: {
          apiKey: 'test-key',
          authDomain: 'test.firebaseapp.com',
          projectId: 'mindcode-test',
          storageBucket: 'test.appspot.com',
          messagingSenderId: '1',
          appId: '1:1:web:1',
        },
      },
    },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/* ---- Firebase: never touched from a UI test ---- */

jest.mock('@/services/firebase', () => ({
  getFirebaseApp: jest.fn(),
  getFirebaseAuth: jest.fn(),
  getDb: jest.fn(),
  getFirebaseFunctions: jest.fn(),
  isFirebaseConfigured: () => true,
}));

jest.mock('@/services/firestore/daily', () => ({
  fetchDailyChallenge: jest.fn(),
  observeDailyChallenge: jest.fn(() => () => undefined),
  fetchDailyEntry: jest.fn(() => Promise.resolve(null)),
  observeDailyEntry: jest.fn(() => () => undefined),
}));

jest.mock('@/services/firestore/sessions', () => ({
  listRecentSessions: jest.fn(() => Promise.resolve([])),
  listSessionsForVariant: jest.fn(() => Promise.resolve([])),
  listDailyEntries: jest.fn(() => Promise.resolve([])),
}));

// Mocked wholesale rather than with `requireActual`: these modules import the
// Firebase SDK at module scope, which does not load under the Jest environment.
// The exported constants are re-declared here so screens still render real copy.
jest.mock('@/services/firestore/leaderboard', () => ({
  fetchLeaderboard: jest.fn(() => Promise.resolve([])),
  fetchMyEntry: jest.fn(() => Promise.resolve(null)),
  periodId: (period: string) => (period === 'global' ? 'global' : '2026-08-01'),
  PERIOD_LABELS: { daily: 'Today', weekly: 'This week', global: 'All time' },
  PERIOD_METRIC_LABELS: { daily: 'score', weekly: 'XP', global: 'XP' },
}));

jest.mock('@/services/firestore/profiles', () => ({
  fetchProfile: jest.fn(() => Promise.resolve(null)),
  ensureProfile: jest.fn(),
  observeProfile: jest.fn(() => () => undefined),
  updateSettings: jest.fn(() => Promise.resolve()),
  updateIdentity: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/submission', () => ({
  submitResult: jest.fn(() =>
    Promise.resolve({
      score: { total: 0, xp: 0, rating: 'solid', components: [], isPersonalBest: false },
      events: [],
      profile: null,
      synced: true,
    }),
  ),
  scoreResult: jest.fn(),
  flushPendingResults: jest.fn(() => Promise.resolve({ sent: 0, remaining: 0 })),
}));

jest.mock('@/services/auth', () => ({
  observeAuth: jest.fn(() => () => undefined),
  currentUser: jest.fn(() => null),
  ensureSignedIn: jest.fn(),
  registerWithEmail: jest.fn(),
  signInWithEmail: jest.fn(),
  requestPasswordReset: jest.fn(),
  signOut: jest.fn(),
  updateDisplayName: jest.fn(),
  deleteAccount: jest.fn(),
  describeAuthError: () => 'Something went wrong. Please try again.',
}));

/* ---- Keep test output about failures, not about React Native's warnings ---- */
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = (...args: unknown[]) => {
    const message = String(args[0] ?? '');
    if (message.includes('useNativeDriver') || message.includes('AsyncStorage')) return;
    originalWarn(...(args as []));
  };
});
afterAll(() => {
  console.warn = originalWarn;
});
