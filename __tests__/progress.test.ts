import type { GameResult } from '@/engine/session';
import { describeLevel, levelForXp, levelTitleKey, MAX_LEVEL, totalXpForLevel } from '@/progress/levels';
import { t } from '@/i18n';
import { applyGameResult } from '@/progress/progressEngine';
import { applyStreak, effectiveStreak, isStreakAtRisk } from '@/progress/streak';
import { averageMoves, averageScore, createProfile, type UserProfile } from '@/progress/types';
import type { ScoreBreakdown } from '@/scoring/types';

const DAY = 86_400_000;
const JAN_1 = Date.UTC(2026, 0, 1, 12);

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    ...createProfile({ uid: 'u1', displayName: 'Tester', isAnonymous: false, now: 0 }),
    ...overrides,
  };
}

function result(overrides: Partial<GameResult> = {}): GameResult {
  return {
    sessionId: 's1',
    moduleId: 'number-logic',
    engineVersion: 1,
    variantId: 'two-digit',
    difficulty: 1,
    mode: 'classic',
    challengeId: null,
    seed: 'seed',
    outcome: {
      status: 'won',
      movesUsed: 3,
      maxMoves: 6,
      durationMs: 30_000,
      accuracy: 0.6,
      metrics: {},
    },
    startedAt: JAN_1,
    finishedAt: JAN_1 + 30_000,
    moves: [],
    solution: '82',
    ...overrides,
  };
}

function score(overrides: Partial<ScoreBreakdown> = {}): ScoreBreakdown {
  return {
    total: 200,
    xp: 100,
    rating: 'solid',
    components: [],
    isPersonalBest: false,
    ...overrides,
  };
}

describe('levels', () => {
  it('starts at level 1 with no XP', () => {
    expect(levelForXp(0)).toBe(1);
    expect(t(levelTitleKey(1))).toBe('Beginner');
  });

  // The brief names these three ranks explicitly, so they are asserted on the
  // rendered string rather than the key — a renamed key must not silently
  // change what the player is called.
  it('uses the titles named in the product brief', () => {
    expect(t(levelTitleKey(10))).toBe('Logic Explorer');
    expect(t(levelTitleKey(50))).toBe('Mind Master');
  });

  it('is monotonic and caps at MAX_LEVEL', () => {
    let previous = 0;
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      const required = totalXpForLevel(level);
      expect(required).toBeGreaterThanOrEqual(previous);
      previous = required;
    }
    expect(levelForXp(Number.MAX_SAFE_INTEGER)).toBe(MAX_LEVEL);
  });

  it('reports progress within the current level', () => {
    const atLevel5 = totalXpForLevel(5);
    const progress = describeLevel(atLevel5);
    expect(progress.level).toBe(5);
    expect(progress.xpIntoLevel).toBe(0);
    expect(progress.ratio).toBe(0);

    const halfway = describeLevel(atLevel5 + Math.floor((totalXpForLevel(6) - atLevel5) / 2));
    expect(halfway.ratio).toBeGreaterThan(0.4);
    expect(halfway.ratio).toBeLessThan(0.6);
  });

  it('clamps the bar at max level instead of overflowing', () => {
    const maxed = describeLevel(totalXpForLevel(MAX_LEVEL) * 10);
    expect(maxed.isMaxLevel).toBe(true);
    expect(maxed.ratio).toBe(1);
    expect(maxed.xpForNextLevel).toBe(0);
  });
});

describe('streaks', () => {
  const fresh = { current: 0, longest: 0, lastPlayedDate: null, freezesUsed: 0 };

  it('starts a streak on the first game', () => {
    const { streak, events } = applyStreak(fresh, JAN_1);
    expect(streak.current).toBe(1);
    expect(streak.lastPlayedDate).toBe('2026-01-01');
    expect(events[0]?.type).toBe('streak_started');
  });

  it('does not advance twice in the same UTC day', () => {
    const day1 = applyStreak(fresh, JAN_1).streak;
    const again = applyStreak(day1, JAN_1 + 3_600_000);
    expect(again.streak.current).toBe(1);
    expect(again.events).toHaveLength(0);
  });

  it('extends across consecutive days', () => {
    let streak = applyStreak(fresh, JAN_1).streak;
    streak = applyStreak(streak, JAN_1 + DAY).streak;
    streak = applyStreak(streak, JAN_1 + 2 * DAY).streak;
    expect(streak.current).toBe(3);
    expect(streak.longest).toBe(3);
  });

  it('resets to 1 — not 0 — after a missed day, and remembers the record', () => {
    let streak = applyStreak(fresh, JAN_1).streak;
    streak = applyStreak(streak, JAN_1 + DAY).streak;

    const broken = applyStreak(streak, JAN_1 + 5 * DAY);
    expect(broken.streak.current).toBe(1);
    expect(broken.streak.longest).toBe(2);
    expect(broken.events.some((e) => e.type === 'streak_broken')).toBe(true);
  });

  it('ignores results timestamped before the last recorded day', () => {
    const streak = applyStreak(fresh, JAN_1 + 3 * DAY).streak;
    const stale = applyStreak(streak, JAN_1);
    expect(stale.streak).toBe(streak);
    expect(stale.events).toHaveLength(0);
  });

  it('shows a lapsed streak as zero without destroying the record', () => {
    const streak = applyStreak(fresh, JAN_1).streak;
    expect(effectiveStreak(streak, JAN_1 + DAY)).toBe(1);
    expect(isStreakAtRisk(streak, JAN_1 + DAY)).toBe(true);
    expect(effectiveStreak(streak, JAN_1 + 3 * DAY)).toBe(0);
    expect(streak.longest).toBe(1);
  });
});

describe('applyGameResult', () => {
  it('folds a win into every aggregate', () => {
    const { profile: next } = applyGameResult({
      profile: profile(),
      result: result(),
      score: score(),
      now: JAN_1,
    });

    expect(next.xp).toBe(100);
    expect(next.stats.played).toBe(1);
    expect(next.stats.won).toBe(1);
    expect(next.stats.totalMoves).toBe(3);
    expect(next.stats.bestScore).toBe(200);
    expect(next.stats.currentWinRun).toBe(1);
    expect(next.modules['number-logic']?.variants['two-digit']?.bestMoves).toBe(3);
    expect(next.streak.current).toBe(1);
  });

  it('does not treat a loss as a best-moves record', () => {
    const { profile: next } = applyGameResult({
      profile: profile(),
      result: result({ outcome: { ...result().outcome, status: 'lost', movesUsed: 6 } }),
      score: score({ total: 15, xp: 7, rating: 'failed' }),
      now: JAN_1,
    });

    expect(next.stats.won).toBe(0);
    expect(next.stats.currentWinRun).toBe(0);
    expect(next.modules['number-logic']?.variants['two-digit']?.bestMoves).toBe(0);
  });

  it('tracks the longest win run across games', () => {
    let current = profile();
    for (let i = 0; i < 3; i += 1) {
      current = applyGameResult({
        profile: current,
        result: result({ sessionId: `s${i}`, finishedAt: JAN_1 + i * DAY }),
        score: score(),
        now: JAN_1 + i * DAY,
      }).profile;
    }
    expect(current.stats.currentWinRun).toBe(3);
    expect(current.stats.longestWinRun).toBe(3);

    const afterLoss = applyGameResult({
      profile: current,
      result: result({ outcome: { ...result().outcome, status: 'lost' } }),
      score: score(),
      now: JAN_1,
    }).profile;
    expect(afterLoss.stats.currentWinRun).toBe(0);
    expect(afterLoss.stats.longestWinRun).toBe(3);
  });

  it('counts daily completions separately', () => {
    const { profile: next } = applyGameResult({
      profile: profile(),
      result: result({ mode: 'daily', challengeId: '2026-01-01' }),
      score: score(),
      now: JAN_1,
    });
    expect(next.stats.dailyCompleted).toBe(1);
  });

  it('emits a level-up event when the threshold is crossed', () => {
    const almost = profile({ xp: totalXpForLevel(2) - 1, level: 1 });
    const { profile: next, events } = applyGameResult({
      profile: almost,
      result: result(),
      score: score({ xp: 50 }),
      now: JAN_1,
    });

    expect(next.level).toBeGreaterThan(1);
    expect(events.some((e) => e.type === 'level_up')).toBe(true);
  });

  it('unlocks badges against the updated profile', () => {
    const { events } = applyGameResult({
      profile: profile(),
      result: result({ outcome: { ...result().outcome, movesUsed: 1 } }),
      score: score({ rating: 'flawless' }),
      localHour: 12,
      now: JAN_1,
    });

    const badges = events.filter((e) => e.type === 'badge_unlocked');
    expect(badges.map((e) => (e.type === 'badge_unlocked' ? e.badgeId : ''))).toEqual(
      expect.arrayContaining(['first_light', 'clean_read']),
    );
  });

  it('never re-awards a badge already held', () => {
    const first = applyGameResult({
      profile: profile(),
      result: result(),
      score: score(),
      localHour: 12,
      now: JAN_1,
    });
    const second = applyGameResult({
      profile: first.profile,
      result: result({ sessionId: 's2' }),
      score: score(),
      localHour: 12,
      now: JAN_1,
    });

    expect(second.events.some((e) => e.type === 'badge_unlocked' && e.badgeId === 'first_light')).toBe(
      false,
    );
  });

  it('leaves the input profile untouched', () => {
    const original = profile();
    const snapshot = JSON.stringify(original);
    applyGameResult({ profile: original, result: result(), score: score(), now: JAN_1 });
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

describe('derived statistics', () => {
  it('reports zero rather than NaN before any game', () => {
    const stats = profile().stats;
    expect(averageScore(stats)).toBe(0);
    expect(averageMoves(stats)).toBe(0);
  });

  it('averages score and guesses over completed games', () => {
    let current = profile();
    current = applyGameResult({ profile: current, result: result(), score: score({ total: 100 }), now: JAN_1 }).profile;
    current = applyGameResult({
      profile: current,
      result: result({ sessionId: 's2', outcome: { ...result().outcome, movesUsed: 5 } }),
      score: score({ total: 300 }),
      now: JAN_1,
    }).profile;

    expect(averageScore(current.stats)).toBe(200);
    expect(averageMoves(current.stats)).toBe(4);
  });
});
