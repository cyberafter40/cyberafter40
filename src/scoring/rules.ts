import type { ScoringRule } from './types';

/**
 * The stock rule library. Each rule is small, independently testable and
 * game-agnostic — it only reads the normalised `GameOutcome`.
 */

/** Flat award for finishing, scaled by the variant's difficulty. */
export const baseCompletionRule: ScoringRule = {
  id: 'base',
  label: 'Solved',
  applies: (ctx) => ctx.result.outcome.status === 'won',
  evaluate: (ctx) => {
    const { basePoints, difficultyStep } = ctx.module;
    const steps = ctx.result.difficulty - 1;
    return {
      id: 'base',
      label: 'Solved',
      kind: 'add',
      value: Math.round(basePoints * (1 + steps * difficultyStep)),
      detail: `${ctx.result.difficulty}★ difficulty`,
    };
  },
};

/** Consolation points so a lost game still shows progress. */
export const participationRule: ScoringRule = {
  id: 'participation',
  label: 'Attempt',
  applies: (ctx) => ctx.result.outcome.status !== 'won',
  evaluate: (ctx) => ({
    id: 'participation',
    label: 'Attempt',
    kind: 'add',
    value: ctx.result.outcome.status === 'abandoned' ? 5 : 15,
    detail: 'Every attempt trains the pattern',
  }),
};

/**
 * Rewards solving with moves to spare. Linear in the fraction of the move
 * budget left over, so it reads intuitively on the result screen.
 */
export const moveEfficiencyRule: ScoringRule = {
  id: 'efficiency',
  label: 'Efficiency',
  applies: (ctx) => ctx.result.outcome.status === 'won',
  evaluate: (ctx) => {
    const { movesUsed, maxMoves } = ctx.result.outcome;
    const saved = Math.max(0, maxMoves - movesUsed);
    if (saved === 0) return null;
    const fraction = saved / maxMoves;
    return {
      id: 'efficiency',
      label: 'Efficiency',
      kind: 'add',
      value: Math.round(fraction * 120),
      detail: `${saved} attempt${saved === 1 ? '' : 's'} to spare`,
    };
  },
};

/**
 * Rewards deduction quality rather than luck: the engine's `accuracy` measures
 * how much of the search space each guess eliminated.
 */
export const deductionRule: ScoringRule = {
  id: 'deduction',
  label: 'Deduction',
  applies: (ctx) => ctx.result.outcome.status === 'won' && ctx.result.outcome.accuracy > 0,
  evaluate: (ctx) => ({
    id: 'deduction',
    label: 'Deduction',
    kind: 'add',
    value: Math.round(ctx.result.outcome.accuracy * 80),
    detail: `${Math.round(ctx.result.outcome.accuracy * 100)}% information per guess`,
  }),
};

/**
 * Gentle speed bonus. Deliberately capped and forgiving — MindCode is a calm
 * daily ritual, not a twitch game, so rushing should never dominate thinking.
 */
export function timeBonusRule(parMs: number, maxBonus = 60): ScoringRule {
  return {
    id: 'speed',
    label: 'Speed',
    applies: (ctx) => ctx.result.outcome.status === 'won',
    evaluate: (ctx) => {
      const { durationMs } = ctx.result.outcome;
      if (durationMs >= parMs) return null;
      const fraction = 1 - durationMs / parMs;
      return {
        id: 'speed',
        label: 'Speed',
        kind: 'add',
        value: Math.round(fraction * maxBonus),
        detail: `${Math.round(durationMs / 1000)}s (par ${Math.round(parMs / 1000)}s)`,
      };
    },
  };
}

/** Daily Challenge results are worth more than free-play. */
export const dailyChallengeRule: ScoringRule = {
  id: 'daily',
  label: 'Daily Challenge',
  applies: (ctx) => ctx.result.mode === 'daily' && ctx.result.outcome.status === 'won',
  evaluate: () => ({
    id: 'daily',
    label: 'Daily Challenge',
    kind: 'multiply',
    value: 1.5,
    detail: 'Same puzzle for everyone today',
  }),
};

/**
 * Streak multiplier, capped so a long streak is an advantage but never makes
 * the leaderboard unreachable for a returning player.
 */
export function streakRule(perDay = 0.03, cap = 1.5): ScoringRule {
  return {
    id: 'streak',
    label: 'Streak',
    applies: (ctx) => ctx.player.currentStreak > 0 && ctx.result.outcome.status === 'won',
    evaluate: (ctx) => {
      const multiplier = Math.min(cap, 1 + ctx.player.currentStreak * perDay);
      if (multiplier <= 1) return null;
      return {
        id: 'streak',
        label: 'Streak',
        kind: 'multiply',
        value: Number(multiplier.toFixed(2)),
        detail: `${ctx.player.currentStreak}-day streak`,
      };
    },
  };
}

/** Perfect games — solved on the first move — get a distinct flourish. */
export const firstTryRule: ScoringRule = {
  id: 'first_try',
  label: 'First try',
  applies: (ctx) => ctx.result.outcome.status === 'won' && ctx.result.outcome.movesUsed === 1,
  evaluate: () => ({
    id: 'first_try',
    label: 'First try',
    kind: 'add',
    value: 100,
    detail: 'Called it immediately',
  }),
};
