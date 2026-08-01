import { GameSession } from '@/engine/session';
import { getGameModule, listLiveGameModules } from '@/engine/registry';
import { registerAllGameModules } from '@/games';
import type { MemoryGridState } from '@/games/memoryGrid/engine';
import type { NumberLogicState } from '@/games/numberLogic/engine';
import { applyGameResult } from '@/progress/progressEngine';
import { createProfile, type UserProfile } from '@/progress/types';
import { getScoringProfile } from '@/scoring/profiles';
import { computeScore } from '@/scoring/scoringEngine';

/**
 * The platform claim, under test.
 *
 * ARCHITECTURE.md asserts that no layer above the engines knows what game is
 * being played, and GAME_ENGINE_GUIDE.md asserts that adding a module needs no
 * changes to scoring, progression or statistics. Memory Grid is the second
 * engine, and this suite is what holds those claims honest: it drives a memory
 * game through the *unmodified* scoring and progress engines and checks the
 * results are meaningful rather than merely non-crashing.
 */

registerAllGameModules();

let clock = 1_000_000;
function play(moduleId: string, variantId: string): GameSession {
  return new GameSession({
    sessionId: `test_${moduleId}_${variantId}`,
    moduleId,
    variantId,
    mode: 'classic',
    seed: `platform:${moduleId}:${variantId}`,
    now: () => (clock += 4_000),
  });
}

function score(session: GameSession, profile: UserProfile) {
  const module = session.module;
  const result = session.toResult();
  return {
    result,
    breakdown: computeScore(getScoringProfile(module.scoringProfileId), {
      result,
      module: {
        id: module.id,
        basePoints: module.scoring.basePoints,
        difficultyStep: module.scoring.difficultyStep,
      },
      player: {
        level: profile.level,
        currentStreak: profile.streak.current,
        personalBest:
          profile.modules[result.moduleId]?.variants[result.variantId]?.bestScore ?? null,
      },
    }),
  };
}

function winMemoryGame(session: GameSession): void {
  const state = session.getState<MemoryGridState>();
  for (const tile of state.sequence) session.submit({ tile });
}

describe('the registry hosts more than one live game', () => {
  it('lists both shipped modules, in different categories', () => {
    const live = listLiveGameModules();
    const ids = live.map((module) => module.id);

    expect(ids).toEqual(expect.arrayContaining(['number-logic', 'memory-grid']));
    expect(new Set(live.map((module) => module.category)).size).toBeGreaterThan(1);
  });

  it('resolves each module to its own renderer and scoring profile', () => {
    expect(getGameModule('number-logic').renderer).not.toBe(
      getGameModule('memory-grid').renderer,
    );
    expect(getGameModule('number-logic').scoringProfileId).not.toBe(
      getGameModule('memory-grid').scoringProfileId,
    );
  });
});

describe('GameSession drives an unfamiliar engine', () => {
  it('runs a memory game to completion through the same runtime', () => {
    const session = play('memory-grid', 'short');
    winMemoryGame(session);

    expect(session.status).toBe('won');
    expect(session.history.length).toBeGreaterThan(0);
    expect(session.history[0]?.label).toMatch(/→ [✓✕]/);

    const result = session.toResult();
    expect(result.moduleId).toBe('memory-grid');
    expect(result.outcome.status).toBe('won');
    // Must survive the trip to Firestore and back, like any other result.
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

describe('the scoring engine handles a new game with no changes', () => {
  it('produces a positive, itemised score for a memory win', () => {
    const profile = createProfile({ uid: 'u', displayName: 'Tester', isAnonymous: false, now: 0 });
    const session = play('memory-grid', 'standard');
    winMemoryGame(session);

    const { breakdown } = score(session, profile);

    expect(breakdown.total).toBeGreaterThan(0);
    expect(breakdown.xp).toBeGreaterThan(0);
    expect(breakdown.components.map((c) => c.id)).toContain('base');
  });

  it('omits move-economy rules that would misfire on a recall task', () => {
    const profile = createProfile({ uid: 'u', displayName: 'Tester', isAnonymous: false, now: 0 });
    const session = play('memory-grid', 'standard');
    winMemoryGame(session);

    const { breakdown } = score(session, profile);
    const ids = breakdown.components.map((c) => c.id);

    // A flawless recall run uses its full tap budget minus the mistake
    // allowance, so `efficiency` would pay out for playing badly and
    // `first_try` could never fire. The recall profile leaves both out.
    expect(ids).not.toContain('efficiency');
    expect(ids).not.toContain('first_try');
    // Precision, which the engine reports as `accuracy`, is what pays instead.
    expect(ids).toContain('deduction');
  });
});

describe('the progress engine handles a new game with no changes', () => {
  const base = () =>
    createProfile({ uid: 'u', displayName: 'Tester', isAnonymous: false, now: 0 });

  it('files statistics under the new module without a schema change', () => {
    const profile = base();
    const session = play('memory-grid', 'short');
    winMemoryGame(session);
    const { result, breakdown } = score(session, profile);

    const { profile: next } = applyGameResult({ profile, result, score: breakdown, now: 1 });

    expect(next.stats.played).toBe(1);
    expect(next.modules['memory-grid']?.won).toBe(1);
    expect(next.modules['memory-grid']?.variants['short']?.bestScore).toBe(breakdown.total);
    expect(next.modules['number-logic']).toBeUndefined();
  });

  it('keeps per-module records separate', () => {
    let profile = base();

    const memory = play('memory-grid', 'short');
    winMemoryGame(memory);
    const memoryScore = score(memory, profile);
    profile = applyGameResult({
      profile,
      result: memoryScore.result,
      score: memoryScore.breakdown,
      now: 1,
    }).profile;

    const numbers = play('number-logic', 'two-digit');
    numbers.submit({ guess: numbers.getState<NumberLogicState>().secret });
    const numbersScore = score(numbers, profile);
    profile = applyGameResult({
      profile,
      result: numbersScore.result,
      score: numbersScore.breakdown,
      now: 2,
    }).profile;

    expect(profile.stats.played).toBe(2);
    expect(Object.keys(profile.modules).sort()).toEqual(['memory-grid', 'number-logic']);
    expect(profile.modules['memory-grid']?.played).toBe(1);
    expect(profile.modules['number-logic']?.played).toBe(1);
  });

  it('awards a badge that keys off the new module’s own metrics', () => {
    const profile = base();
    const session = play('memory-grid', 'short');
    winMemoryGame(session); // flawless — no mistakes
    const { result, breakdown } = score(session, profile);

    const { events } = applyGameResult({ profile, result, score: breakdown, localHour: 12, now: 1 });
    const badges = events.flatMap((e) => (e.type === 'badge_unlocked' ? [e.badgeId] : []));

    expect(badges).toContain('total_recall');
  });

  it('awards a cross-module badge once two games have been won', () => {
    let profile = base();

    const memory = play('memory-grid', 'short');
    winMemoryGame(memory);
    const memoryScore = score(memory, profile);
    const first = applyGameResult({
      profile,
      result: memoryScore.result,
      score: memoryScore.breakdown,
      localHour: 12,
      now: 1,
    });
    profile = first.profile;

    expect(
      first.events.flatMap((e) => (e.type === 'badge_unlocked' ? [e.badgeId] : [])),
    ).not.toContain('polymath');

    const numbers = play('number-logic', 'two-digit');
    numbers.submit({ guess: numbers.getState<NumberLogicState>().secret });
    const numbersScore = score(numbers, profile);
    const second = applyGameResult({
      profile,
      result: numbersScore.result,
      score: numbersScore.breakdown,
      localHour: 12,
      now: 2,
    });

    expect(
      second.events.flatMap((e) => (e.type === 'badge_unlocked' ? [e.badgeId] : [])),
    ).toContain('polymath');
  });

  it('does not misfire number-game badges on a memory result', () => {
    const profile = base();
    const session = play('memory-grid', 'short');
    winMemoryGame(session);
    const { result, breakdown } = score(session, profile);

    const { events } = applyGameResult({ profile, result, score: breakdown, localHour: 12, now: 1 });
    const badges = events.flatMap((e) => (e.type === 'badge_unlocked' ? [e.badgeId] : []));

    // These read variantId/movesUsed and could plausibly collide across games.
    expect(badges).not.toContain('deep_end');
    expect(badges).not.toContain('clean_read');
    expect(badges).not.toContain('four_dimensional');
  });
});
