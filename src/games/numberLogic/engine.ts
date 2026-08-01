import {
  invalid,
  VALID,
  type ApplyMoveResult,
  type CreateStateInput,
  type GameEngine,
  type GameOutcome,
  type GameStatus,
  type MoveValidation,
} from '@/engine/types';
import { compareCodes, isConsistentWithScore } from './matching';
import {
  CANDIDATE_ENUMERATION_LIMIT,
  codeSpaceSize,
  enumerateCodes,
  generateSecret,
  isWellFormedGuess,
  type NumberLogicConfig,
} from './generator';
import { getFeedbackPolicy, scoreCounts, type DigitMatchCounts } from './policies';

/** A single guess. */
export interface NumberLogicMove {
  guess: string;
}

/** What the player learns back. */
export interface NumberLogicFeedback {
  guess: string;
  counts: DigitMatchCounts;
  /** Policy-weighted score, e.g. +2 / 0 / −2. */
  score: number;
  /** Pre-formatted for display, e.g. `−2`. */
  display: string;
  solved: boolean;
  attemptsLeft: number;
  /** Codes still consistent with everything known so far, or null if unmeasured. */
  candidatesRemaining: number | null;
}

export interface NumberLogicAttempt {
  guess: string;
  counts: DigitMatchCounts;
  score: number;
  atMs: number;
  candidatesRemaining: number | null;
}

export interface NumberLogicState {
  config: NumberLogicConfig;
  secret: string;
  attempts: NumberLogicAttempt[];
  status: GameStatus;
  startedAt: number;
  finishedAt: number | null;
  /** Size of the search space at the start; null when not enumerable. */
  initialCandidates: number | null;
}

/**
 * The MindCode flagship engine: guess the hidden code, scored by a swappable
 * `FeedbackPolicy` (+1 / −1 / 0 by default).
 *
 * The engine is pure and fully replayable from `(config, seed, moves)`, which
 * is what lets the backend re-derive the secret and verify a submitted result.
 */
export const numberLogicEngine: GameEngine<
  NumberLogicState,
  NumberLogicMove,
  NumberLogicFeedback,
  NumberLogicConfig
> = {
  id: 'number-logic',
  version: 1,

  createInitialState({ config, rng, startedAt }: CreateStateInput<NumberLogicConfig>): NumberLogicState {
    const space = codeSpaceSize(config);
    return {
      config,
      secret: generateSecret(config, rng),
      attempts: [],
      status: 'in_progress',
      startedAt,
      finishedAt: null,
      initialCandidates: space <= CANDIDATE_ENUMERATION_LIMIT ? space : null,
    };
  },

  validateMove(state: NumberLogicState, move: NumberLogicMove): MoveValidation {
    if (state.status !== 'in_progress') {
      return invalid('game_over', 'numberLogic.errorGameOver');
    }
    if (!isWellFormedGuess(move.guess, state.config)) {
      return invalid('malformed', 'numberLogic.errorMalformed', { digits: state.config.digits });
    }
    if (state.attempts.some((a) => a.guess === move.guess)) {
      return invalid('duplicate', 'numberLogic.errorDuplicate');
    }
    return VALID;
  },

  applyMove(
    state: NumberLogicState,
    move: NumberLogicMove,
    at: number,
  ): ApplyMoveResult<NumberLogicState, NumberLogicFeedback> {
    const policy = getFeedbackPolicy(state.config.policyId);
    const counts = compareCodes(state.secret, move.guess);
    const score = scoreCounts(policy, counts);
    const solved = counts.exact === state.config.digits;

    const attempts: NumberLogicAttempt[] = [
      ...state.attempts,
      {
        guess: move.guess,
        counts,
        score,
        atMs: at - state.startedAt,
        candidatesRemaining: null,
      },
    ];

    const last = attempts[attempts.length - 1] as NumberLogicAttempt;
    last.candidatesRemaining = countConsistentCandidates(state.config, attempts);

    const outOfAttempts = attempts.length >= state.config.maxAttempts;
    const status: GameStatus = solved ? 'won' : outOfAttempts ? 'lost' : 'in_progress';

    const next: NumberLogicState = {
      ...state,
      attempts,
      status,
      finishedAt: status === 'in_progress' ? null : at,
    };

    return {
      state: next,
      feedback: {
        guess: move.guess,
        counts,
        score,
        display: policy.format(score),
        solved,
        attemptsLeft: Math.max(0, state.config.maxAttempts - attempts.length),
        candidatesRemaining: last.candidatesRemaining,
      },
    };
  },

  isTerminal: (state) => state.status !== 'in_progress',

  getOutcome(state: NumberLogicState, at: number): GameOutcome {
    const status = state.status === 'in_progress' ? 'abandoned' : state.status;
    const finishedAt = state.finishedAt ?? at;

    return {
      status,
      movesUsed: state.attempts.length,
      maxMoves: state.config.maxAttempts,
      durationMs: Math.max(0, finishedAt - state.startedAt),
      accuracy: deductionAccuracy(state),
      metrics: {
        digits: state.config.digits,
        exactHitsTotal: state.attempts.reduce((sum, a) => sum + a.counts.exact, 0),
        finalCandidates: state.attempts[state.attempts.length - 1]?.candidatesRemaining ?? 0,
        initialCandidates: state.initialCandidates ?? 0,
      },
    };
  },

  abandon(state: NumberLogicState, at: number): NumberLogicState {
    if (state.status !== 'in_progress') return state;
    return { ...state, status: 'abandoned', finishedAt: at };
  },

  revealSolution(state: NumberLogicState): string {
    if (state.status === 'in_progress') {
      throw new Error('revealSolution() called while the game is still in progress');
    }
    return state.secret;
  },

  describeMove(move: NumberLogicMove, feedback: NumberLogicFeedback): string {
    return `${move.guess} → ${feedback.display}`;
  },
};

/**
 * Codes still consistent with every guess made so far. Returns null when the
 * space is too large to enumerate — callers must treat that as "unknown", not
 * as zero.
 */
export function countConsistentCandidates(
  config: NumberLogicConfig,
  attempts: NumberLogicAttempt[],
): number | null {
  const all = enumerateCodes(config);
  if (!all) return null;

  const policy = getFeedbackPolicy(config.policyId);
  return all.filter((candidate) =>
    attempts.every((attempt) =>
      isConsistentWithScore(candidate, attempt.guess, attempt.score, policy),
    ),
  ).length;
}

/**
 * Digits that cannot appear in the secret, given everything guessed so far.
 *
 * Derived by intersecting the surviving candidate set rather than by pattern-
 * matching on scores, so it is exactly as informed as a perfect logician — and
 * never wrong. The keypad dims these as a memory aid; it never blocks them,
 * because being allowed to make a "pointless" guess is part of thinking aloud.
 */
export function eliminatedDigits(
  config: NumberLogicConfig,
  attempts: NumberLogicAttempt[],
): Set<string> {
  const eliminated = new Set<string>();
  if (attempts.length === 0) return eliminated;

  const all = enumerateCodes(config);
  if (!all) return eliminated;

  const policy = getFeedbackPolicy(config.policyId);
  const survivors = all.filter((candidate) =>
    attempts.every((attempt) =>
      isConsistentWithScore(candidate, attempt.guess, attempt.score, policy),
    ),
  );

  const possible = new Set<string>();
  for (const candidate of survivors) {
    for (const digit of candidate) possible.add(digit);
  }

  for (const digit of '0123456789') {
    if (!possible.has(digit)) eliminated.add(digit);
  }
  return eliminated;
}

/**
 * How much of the *remaining* uncertainty each guess removed, averaged over the
 * game and normalised to 0..1.
 *
 * Measuring information gain rather than raw guess count is what separates
 * genuine deduction from a lucky stab: a player who narrows 1000 candidates to
 * 12 in one guess is playing well even if it takes another two to finish. When
 * the search space is too large to enumerate we fall back to a move-economy
 * approximation so downstream scoring always receives a usable number.
 */
export function deductionAccuracy(state: NumberLogicState): number {
  const { attempts, initialCandidates } = state;
  if (attempts.length === 0) return 0;

  if (initialCandidates === null || attempts.some((a) => a.candidatesRemaining === null)) {
    const ratio = state.config.maxAttempts / Math.max(1, attempts.length);
    return clamp01(ratio / state.config.maxAttempts + 0.2);
  }

  let before = initialCandidates;
  let gainedBits = 0;
  let availableBits = 0;

  for (const attempt of attempts) {
    const after = Math.max(1, attempt.candidatesRemaining ?? before);
    const uncertainty = Math.log2(Math.max(1, before));
    if (uncertainty > 0) {
      availableBits += uncertainty;
      gainedBits += Math.log2(before / after);
    }
    before = after;
  }

  return availableBits === 0 ? 0 : clamp01(gainedBits / availableBits);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
