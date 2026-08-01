import type { GameResult } from '@/engine/session';
import { computeScore, rateOutcome } from '@/scoring/scoringEngine';
import { standardScoringProfile } from '@/scoring/profiles';
import type { ScoringContext, ScoringRule } from '@/scoring/types';

function makeResult(overrides: Partial<GameResult> = {}): GameResult {
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
      durationMs: 60_000,
      accuracy: 0.5,
      metrics: {},
    },
    startedAt: 0,
    finishedAt: 60_000,
    moves: [],
    solution: '82',
    ...overrides,
  };
}

function makeContext(result: GameResult, player: Partial<ScoringContext['player']> = {}): ScoringContext {
  return {
    result,
    module: { id: 'number-logic', basePoints: 120, difficultyStep: 0.35 },
    player: { level: 1, currentStreak: 0, personalBest: null, ...player },
  };
}

describe('computeScore', () => {
  it('awards nothing but participation for a loss', () => {
    const score = computeScore(
      standardScoringProfile,
      makeContext(makeResult({ outcome: { ...makeResult().outcome, status: 'lost' } })),
    );
    expect(score.total).toBe(15);
    expect(score.rating).toBe('failed');
    expect(score.components.map((c) => c.id)).toEqual(['participation']);
  });

  it('scales the base award with difficulty', () => {
    const easy = computeScore(standardScoringProfile, makeContext(makeResult()));
    const hard = computeScore(
      standardScoringProfile,
      makeContext(makeResult({ difficulty: 5 })),
    );
    expect(hard.total).toBeGreaterThan(easy.total);
  });

  it('rewards finishing with attempts to spare', () => {
    const thrifty = computeScore(
      standardScoringProfile,
      makeContext(makeResult({ outcome: { ...makeResult().outcome, movesUsed: 2 } })),
    );
    const wasteful = computeScore(
      standardScoringProfile,
      makeContext(makeResult({ outcome: { ...makeResult().outcome, movesUsed: 6 } })),
    );
    expect(thrifty.total).toBeGreaterThan(wasteful.total);
  });

  it('applies mode and streak multipliers on top of the raw score', () => {
    const plain = computeScore(standardScoringProfile, makeContext(makeResult()));
    const daily = computeScore(
      standardScoringProfile,
      makeContext(makeResult({ mode: 'daily', challengeId: '2026-08-01' }), {
        currentStreak: 10,
      }),
    );

    expect(daily.total).toBeGreaterThan(plain.total);
    expect(daily.components.some((c) => c.id === 'daily' && c.kind === 'multiply')).toBe(true);
    expect(daily.components.some((c) => c.id === 'streak' && c.kind === 'multiply')).toBe(true);
  });

  it('caps the streak multiplier so a long streak cannot run away', () => {
    const long = computeScore(standardScoringProfile, makeContext(makeResult(), { currentStreak: 400 }));
    const streak = long.components.find((c) => c.id === 'streak');
    expect(streak?.value).toBeLessThanOrEqual(1.5);
  });

  it('weights XP by game mode', () => {
    const classic = computeScore(standardScoringProfile, makeContext(makeResult()));
    const practice = computeScore(
      standardScoringProfile,
      makeContext(makeResult({ mode: 'practice' })),
    );
    expect(practice.xp).toBeLessThan(classic.xp);
  });

  it('never returns a negative total', () => {
    const punishing: ScoringRule = {
      id: 'penalty',
      label: 'Penalty',
      applies: () => true,
      evaluate: () => ({ id: 'penalty', label: 'Penalty', kind: 'add', value: -10_000 }),
    };
    const score = computeScore(
      { ...standardScoringProfile, rules: [punishing] },
      makeContext(makeResult()),
    );
    expect(score.total).toBe(0);
    expect(score.xp).toBe(0);
  });

  it('flags a personal best only when the previous best is beaten', () => {
    const result = makeResult();
    expect(computeScore(standardScoringProfile, makeContext(result, { personalBest: 10_000 })).isPersonalBest).toBe(false);
    expect(computeScore(standardScoringProfile, makeContext(result, { personalBest: 1 })).isPersonalBest).toBe(true);
  });

  it('runs multiplicative rules against the accumulated total, in order', () => {
    const add: ScoringRule = {
      id: 'a',
      label: 'A',
      applies: () => true,
      evaluate: () => ({ id: 'a', label: 'A', kind: 'add', value: 100 }),
    };
    const double: ScoringRule = {
      id: 'b',
      label: 'B',
      applies: () => true,
      evaluate: () => ({ id: 'b', label: 'B', kind: 'multiply', value: 2 }),
    };

    const score = computeScore(
      { ...standardScoringProfile, rules: [add, double] },
      makeContext(makeResult()),
    );
    expect(score.total).toBe(200);
    expect(score.components[1]?.points).toBe(100);
  });
});

describe('rateOutcome', () => {
  const rate = (movesUsed: number, status: 'won' | 'lost' = 'won') =>
    rateOutcome(makeContext(makeResult({ outcome: { ...makeResult().outcome, movesUsed, status } })));

  it('grades on move economy rather than raw score', () => {
    expect(rate(1)).toBe('flawless');
    expect(rate(2)).toBe('excellent');
    expect(rate(4)).toBe('solid');
    expect(rate(6)).toBe('scraped');
    expect(rate(3, 'lost')).toBe('failed');
  });
});
