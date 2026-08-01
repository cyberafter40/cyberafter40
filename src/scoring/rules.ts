import type { ScoringRule } from './types';

/**
 * The stock rule library. Each rule is small, independently testable and
 * game-agnostic — it only reads the normalised `GameOutcome`.
 */

/** Flat award for finishing, scaled by the variant's difficulty. */
export const baseCompletionRule: ScoringRule = {
  id: 'base',
  name: 'Solved',
  applies: (ctx) => ctx.result.outcome.status === 'won',
  evaluate: (ctx) => {
    const { basePoints, difficultyStep } = ctx.module;
    const steps = ctx.result.difficulty - 1;
    return {
      id: 'base',
      labelKey: 'scoring.base',
      kind: 'add',
      value: Math.round(basePoints * (1 + steps * difficultyStep)),
      detailKey: 'scoring.baseDetail',
      detailParams: { difficulty: ctx.result.difficulty },
    };
  },
};

/** Consolation points so a lost game still shows progress. */
export const participationRule: ScoringRule = {
  id: 'participation',
  name: 'Attempt',
  applies: (ctx) => ctx.result.outcome.status !== 'won',
  evaluate: (ctx) => ({
    id: 'participation',
    labelKey: 'scoring.participation',
    kind: 'add',
    value: ctx.result.outcome.status === 'abandoned' ? 5 : 15,
    detailKey: 'scoring.participationDetail',
  }),
};

/**
 * Rewards solving with moves to spare. Linear in the fraction of the move
 * budget left over, so it reads intuitively on the result screen.
 */
export const moveEfficiencyRule: ScoringRule = {
  id: 'efficiency',
  name: 'Efficiency',
  applies: (ctx) => ctx.result.outcome.status === 'won',
  evaluate: (ctx) => {
    const { movesUsed, maxMoves } = ctx.result.outcome;
    const saved = Math.max(0, maxMoves - movesUsed);
    if (saved === 0) return null;
    const fraction = saved / maxMoves;
    return {
      id: 'efficiency',
      labelKey: 'scoring.efficiency',
      kind: 'add',
      value: Math.round(fraction * 120),
      detailKey: 'scoring.efficiencyDetail',
      detailParams: { count: saved },
    };
  },
};

/**
 * Rewards deduction quality rather than luck: the engine's `accuracy` measures
 * how much of the search space each guess eliminated.
 */
export const deductionRule: ScoringRule = {
  id: 'deduction',
  name: 'Deduction',
  applies: (ctx) => ctx.result.outcome.status === 'won' && ctx.result.outcome.accuracy > 0,
  evaluate: (ctx) => ({
    id: 'deduction',
    labelKey: 'scoring.deduction',
    kind: 'add',
    value: Math.round(ctx.result.outcome.accuracy * 80),
    detailKey: 'scoring.deductionDetail',
    detailParams: { percent: Math.round(ctx.result.outcome.accuracy * 100) },
  }),
};

/**
 * Gentle speed bonus. Deliberately capped and forgiving — MindCode is a calm
 * daily ritual, not a twitch game, so rushing should never dominate thinking.
 */
export function timeBonusRule(parMs: number, maxBonus = 60): ScoringRule {
  return {
    id: 'speed',
    name: 'Speed',
    applies: (ctx) => ctx.result.outcome.status === 'won',
    evaluate: (ctx) => {
      const { durationMs } = ctx.result.outcome;
      if (durationMs >= parMs) return null;
      const fraction = 1 - durationMs / parMs;
      return {
        id: 'speed',
        labelKey: 'scoring.speed',
        kind: 'add',
        value: Math.round(fraction * maxBonus),
        detailKey: 'scoring.speedDetail',
        detailParams: {
          seconds: Math.round(durationMs / 1000),
          par: Math.round(parMs / 1000),
        },
      };
    },
  };
}

/** Daily Challenge results are worth more than free-play. */
export const dailyChallengeRule: ScoringRule = {
  id: 'daily',
  name: 'Daily Challenge',
  applies: (ctx) => ctx.result.mode === 'daily' && ctx.result.outcome.status === 'won',
  evaluate: () => ({
    id: 'daily',
    labelKey: 'scoring.daily',
    kind: 'multiply',
    value: 1.5,
    detailKey: 'scoring.dailyDetail',
  }),
};

/**
 * Streak multiplier, capped so a long streak is an advantage but never makes
 * the leaderboard unreachable for a returning player.
 */
export function streakRule(perDay = 0.03, cap = 1.5): ScoringRule {
  return {
    id: 'streak',
    name: 'Streak',
    applies: (ctx) => ctx.player.currentStreak > 0 && ctx.result.outcome.status === 'won',
    evaluate: (ctx) => {
      const multiplier = Math.min(cap, 1 + ctx.player.currentStreak * perDay);
      if (multiplier <= 1) return null;
      return {
        id: 'streak',
        labelKey: 'scoring.streak',
        kind: 'multiply',
        value: Number(multiplier.toFixed(2)),
        detailKey: 'scoring.streakDetail',
        detailParams: { count: ctx.player.currentStreak },
      };
    },
  };
}

/** Perfect games — solved on the first move — get a distinct flourish. */
export const firstTryRule: ScoringRule = {
  id: 'first_try',
  name: 'First try',
  applies: (ctx) => ctx.result.outcome.status === 'won' && ctx.result.outcome.movesUsed === 1,
  evaluate: () => ({
    id: 'first_try',
    labelKey: 'scoring.firstTry',
    kind: 'add',
    value: 100,
    detailKey: 'scoring.firstTryDetail',
  }),
};
