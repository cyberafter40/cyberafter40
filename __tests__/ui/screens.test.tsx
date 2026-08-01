import React from 'react';
import { deriveDailyChallenge } from '@/daily/challenge';
import { HomeScreen } from '@/screens/HomeScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { ResultScreen } from '@/screens/ResultScreen';
import { LeaderboardScreen } from '@/screens/LeaderboardScreen';
import { BadgesScreen } from '@/screens/BadgesScreen';
import { fetchDailyChallenge, fetchDailyEntry } from '@/services/firestore/daily';
import { fetchLeaderboard } from '@/services/firestore/leaderboard';
import { toDateKey } from '@/utils/date';
import { fireEvent, makeProfile, renderWithProviders, screen, waitFor } from './helpers';

/**
 * Screen tests.
 *
 * Each screen is rendered with real components, real theming and real
 * derivation (levels, streaks, statistics) — only the data supply is injected.
 * The point is to catch the class of defect that types and unit tests cannot:
 * a screen that renders the wrong branch, drops a section, or shows a number
 * the user was not supposed to see yet.
 */

const mockAuthValue = {
  user: { uid: 'test-uid', email: 'a@b.c', displayName: 'Quiet Falcon', isAnonymous: false },
  initialising: false,
  signUp: jest.fn(),
  signIn: jest.fn(),
  resetPassword: jest.fn(),
  signOut: jest.fn(),
  deleteAccount: jest.fn(),
};

const mockProfileValue = {
  profile: makeProfile(),
  loading: false,
  syncError: null,
  streak: 0,
  applyLocalProfile: jest.fn(),
  updateSettings: jest.fn(),
  updateProfileIdentity: jest.fn(),
};

jest.mock('@/state/AuthContext', () => ({
  __esModule: true,
  useAuth: () => mockAuthValue,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/state/ProfileContext', () => ({
  __esModule: true,
  useProfile: () => mockProfileValue,
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const react = require('react');
  return {
    ...actual,
    // Screens refresh on focus; in a test the screen is always focused.
    useFocusEffect: (callback: () => void) => react.useEffect(callback, []),
  };
});

const navigation = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  mockProfileValue.profile = makeProfile();
  mockProfileValue.streak = 0;
});

/* ---------------- Home ---------------- */

const TODAY = toDateKey();
const CHALLENGE = deriveDailyChallenge(TODAY);

function primeDaily(entry: unknown = null) {
  (fetchDailyChallenge as jest.Mock).mockResolvedValue({ ...CHALLENGE, stats: null });
  (fetchDailyEntry as jest.Mock).mockResolvedValue(entry);
}

function renderHome() {
  return renderWithProviders(
    <HomeScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );
}

describe('HomeScreen', () => {
  it('offers today’s challenge as the single primary action', async () => {
    primeDaily(null);
    renderHome();

    await waitFor(() => expect(screen.getByText('Daily Challenge')).toBeTruthy());
    expect(screen.getByRole('button', { name: /Play today’s code/ })).toBeTruthy();
    expect(
      screen.getByText('Everyone in the world gets the same code today. One attempt.'),
    ).toBeTruthy();
  });

  it('starts the daily game with the derived challenge, not an invented one', async () => {
    primeDaily(null);
    renderHome();

    await waitFor(() => screen.getByRole('button', { name: /Play today’s code/ }));
    fireEvent.press(screen.getByRole('button', { name: /Play today’s code/ }));

    expect(navigation.navigate).toHaveBeenCalledWith(
      'Game',
      expect.objectContaining({
        mode: 'daily',
        moduleId: CHALLENGE.moduleId,
        variantId: CHALLENGE.variantId,
        seed: CHALLENGE.seed,
        challengeId: TODAY,
        sessionId: `test-uid_${TODAY}`,
      }),
    );
  });

  it('replaces the play button with a countdown once the attempt is spent', async () => {
    primeDaily({
      challengeId: TODAY,
      uid: 'test-uid',
      sessionId: 's',
      status: 'won',
      score: 310,
      xp: 150,
      movesUsed: 3,
      maxMoves: 6,
      durationMs: 42_000,
      moveLog: [],
      finishedAt: Date.now(),
    });
    renderHome();

    await waitFor(() => expect(screen.getByText('Next challenge in')).toBeTruthy());
    expect(screen.getByText(/Solved in 3 guesses for 310 points/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Play today’s code/ })).toBeNull();
  });

  it('lists every live module from the registry, not a hardcoded game', async () => {
    primeDaily(null);
    renderHome();

    await waitFor(() => screen.getByText('Daily Challenge'));

    // This is the regression test for the leak that shipping a second engine
    // exposed: the free-play section used to name 'number-logic' directly.
    expect(screen.getByText(/Number Logic/)).toBeTruthy();
    expect(screen.getByText(/Memory Grid/)).toBeTruthy();
    // "Two Digits" appears twice on purpose — once as today's daily variant,
    // once as a free-play card — so this asserts presence, not uniqueness.
    expect(screen.getAllByText('Two Digits').length).toBeGreaterThan(0);
    expect(screen.getByText('Four Tiles')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play Memory Grid, Four Tiles' })).toBeTruthy();
  });

  it('locks variants above the player’s level and says what unlocks them', async () => {
    primeDaily(null);
    renderHome();
    await waitFor(() => screen.getByText('Daily Challenge'));

    // Level 1 profile: the four-digit variant unlocks at 8.
    expect(screen.getByText('Unlocks at level 8')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Play Number Logic, Four Digits/ })).toBeNull();
  });

  it('shows roadmap modules as teasers rather than hiding them', async () => {
    primeDaily(null);
    renderHome();
    await waitFor(() => screen.getByText('Daily Challenge'));

    expect(screen.getByText('Coming to MindCode')).toBeTruthy();
    expect(screen.getByText('Pattern Sense')).toBeTruthy();
  });

  it('shows a dash instead of a flame when there is no streak', async () => {
    primeDaily(null);
    renderHome();
    await waitFor(() => screen.getByText('Daily Challenge'));

    expect(screen.getByText('—')).toBeTruthy();
  });

  it('shows the streak once there is one', async () => {
    primeDaily(null);
    mockProfileValue.streak = 12;
    renderHome();
    await waitFor(() => screen.getByText('Daily Challenge'));

    expect(screen.getByText('🔥 12')).toBeTruthy();
  });
});

/* ---------------- Result ---------------- */

function renderResult(overrides: Record<string, unknown> = {}) {
  const params = {
    moduleId: 'number-logic',
    variantId: 'two-digit',
    mode: 'daily',
    status: 'won',
    movesUsed: 3,
    maxMoves: 6,
    durationMs: 42_000,
    solution: '82',
    guesses: ['56:0', '28:−2', '82:+2'],
    score: {
      total: 310,
      xp: 217,
      rating: 'solid',
      isPersonalBest: false,
      components: [
        { id: 'base', label: 'Solved', kind: 'add', value: 120, points: 120, detail: '1★ difficulty' },
        { id: 'daily', label: 'Daily Challenge', kind: 'multiply', value: 1.5, points: 103 },
      ],
    },
    events: [],
    synced: true,
    ...overrides,
  };

  return renderWithProviders(
    <ResultScreen
      navigation={navigation as never}
      route={{ key: 'Result', name: 'Result', params } as never}
    />,
  );
}

describe('ResultScreen', () => {
  it('reveals the code and what the game was worth', () => {
    renderResult();

    expect(screen.getByText('82')).toBeTruthy();
    expect(screen.getByLabelText('Score: 310')).toBeTruthy();
    expect(screen.getByLabelText('XP earned: +217')).toBeTruthy();
    expect(screen.getByLabelText('Guesses: 3/6')).toBeTruthy();
  });

  it('itemises the score so the player learns what paid', () => {
    renderResult();

    expect(screen.getByText('How it scored')).toBeTruthy();
    expect(screen.getByText('Solved')).toBeTruthy();
    expect(screen.getByText('+120')).toBeTruthy();
    // Multiplicative components read as a factor, not a raw delta.
    expect(screen.getByText('×1.5')).toBeTruthy();
  });

  it('marks a loss without pretending it was a win', () => {
    renderResult({ status: 'lost', score: { total: 15, xp: 7, rating: 'failed', components: [], isPersonalBest: false } });

    expect(screen.getByText('Not this time')).toBeTruthy();
    expect(screen.getByLabelText('Guesses: X/6')).toBeTruthy();
  });

  it('stays quiet about levelling when nothing levelled', () => {
    renderResult();
    expect(screen.queryByText(/Logic Explorer/)).toBeNull();
  });

  it('celebrates a level-up when one happened', () => {
    renderResult({
      events: [{ type: 'level_up', from: 9, to: 10, title: 'Logic Explorer' }],
    });
    expect(screen.getByText('Level 10 — Logic Explorer')).toBeTruthy();
  });

  it('says plainly when a result has not synced', () => {
    renderResult({ synced: false });
    expect(
      screen.getByText('Saved on this device — it will sync when you are back online.'),
    ).toBeTruthy();
  });
});

/* ---------------- Profile ---------------- */

function renderProfile() {
  return renderWithProviders(
    <ProfileScreen
      navigation={navigation as never}
      route={{ key: 'Profile', name: 'Profile' } as never}
    />,
  );
}

describe('ProfileScreen', () => {
  it('shows dashes rather than zeroes before the first game', async () => {
    renderProfile();

    await waitFor(() => expect(screen.getByText('Quiet Falcon')).toBeTruthy());
    expect(screen.getByLabelText('Games played: 0, 0 solved')).toBeTruthy();
    expect(screen.getByLabelText('Win rate: —')).toBeTruthy();
    expect(screen.getByLabelText('Average score: —')).toBeTruthy();
  });

  it('derives the statistics the brief asked for from the stored totals', async () => {
    mockProfileValue.profile = makeProfile({
      xp: 4_000,
      level: 12,
      stats: {
        played: 40,
        won: 31,
        totalMoves: 148,
        totalScore: 9_400,
        bestScore: 620,
        totalDurationMs: 1_800_000,
        dailyCompleted: 22,
        flawlessWins: 3,
        currentWinRun: 4,
        longestWinRun: 9,
      },
    });
    mockProfileValue.streak = 18;

    renderProfile();
    await waitFor(() => expect(screen.getByText('Quiet Falcon')).toBeTruthy());

    expect(screen.getByLabelText('Games played: 40, 31 solved')).toBeTruthy();
    expect(screen.getByLabelText('Win rate: 78%')).toBeTruthy();
    expect(screen.getByLabelText('Average score: 235')).toBeTruthy();   // 9400 / 40
    expect(screen.getByLabelText('Best score: 620')).toBeTruthy();
    expect(screen.getByLabelText('Avg. guesses: 3.7, 148 total attempts')).toBeTruthy();
    expect(screen.getByLabelText('Daily challenges: 22')).toBeTruthy();
    expect(screen.getByLabelText(/Current streak: 18/)).toBeTruthy();
  });

  it('invites an anonymous player to keep their progress', async () => {
    mockProfileValue.profile = makeProfile({ isAnonymous: true });
    renderProfile();

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Create an account to save progress' }),
      ).toBeTruthy(),
    );
  });
});

/* ---------------- Leaderboard ---------------- */

describe('LeaderboardScreen', () => {
  it('invites the first player rather than showing an empty list', async () => {
    (fetchLeaderboard as jest.Mock).mockResolvedValue([]);
    renderWithProviders(<LeaderboardScreen />);

    await waitFor(() => expect(screen.getByText('Be the first')).toBeTruthy());
  });

  it('ranks players and highlights the current user', async () => {
    (fetchLeaderboard as jest.Mock).mockResolvedValue([
      { uid: 'a', displayName: 'Sharp Cipher', avatarId: 1, countryCode: null, score: 900, level: 20, movesUsed: 2, updatedAt: 0, rank: 1, isCurrentUser: false },
      { uid: 'test-uid', displayName: 'Quiet Falcon', avatarId: 0, countryCode: null, score: 700, level: 12, movesUsed: 4, updatedAt: 0, rank: 2, isCurrentUser: true },
    ]);

    renderWithProviders(<LeaderboardScreen />);

    await waitFor(() => expect(screen.getByText('Sharp Cipher')).toBeTruthy());
    expect(screen.getByLabelText('Rank 1, Sharp Cipher, 900 score')).toBeTruthy();
    expect(screen.getByLabelText('Rank 2, Quiet Falcon, 700 score')).toBeTruthy();
  });
});

/* ---------------- Badges ---------------- */

describe('BadgesScreen', () => {
  it('hides secret badges until they are earned', () => {
    renderWithProviders(<BadgesScreen />);

    // Three badges are secret; all of them must read as "???" until earned.
    expect(screen.getAllByLabelText('Hidden badge, not yet unlocked')).toHaveLength(3);
    expect(screen.queryByText('Night Owl')).toBeNull();
  });

  it('reveals a badge once the profile holds it', () => {
    mockProfileValue.profile = makeProfile({
      badges: { first_light: { id: 'first_light', unlockedAt: 1_700_000_000_000 } },
    });
    renderWithProviders(<BadgesScreen />);

    expect(screen.getByLabelText(/First Light, unlocked/)).toBeTruthy();
  });
});
