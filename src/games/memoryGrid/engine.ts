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
import {
  generateSequence,
  isValidTile,
  tapBudget,
  type MemoryGridConfig,
} from './generator';

/** A single tap. */
export interface MemoryGridMove {
  tile: number;
}

/** What the player learns from that tap. */
export interface MemoryGridFeedback {
  tile: number;
  correct: boolean;
  /** How much of the sequence is now reproduced. */
  recalled: number;
  sequenceLength: number;
  mistakesLeft: number;
  solved: boolean;
}

export interface MemoryGridState {
  config: MemoryGridConfig;
  /** The sequence to reproduce — this engine's secret. */
  sequence: number[];
  /** Correct taps so far, in order. */
  entered: number[];
  mistakes: number;
  /** Every tap, right or wrong. */
  taps: number;
  status: GameStatus;
  startedAt: number;
  finishedAt: number | null;
}

/**
 * Memory Grid — watch a sequence of tiles, then reproduce it.
 *
 * The second engine in MindCode, and the one that tests whether the platform
 * abstraction is real. It shares nothing with the number game except the
 * `GameEngine` contract, and needed no changes to scoring, progression,
 * persistence, analytics or navigation to work.
 *
 * A wrong tap costs a mistake but does **not** reset progress. Simon's
 * start-from-the-top rule is punishing in a five-minute daily ritual, and it
 * makes the tap count unbounded — which in turn makes the game unscoreable
 * against a fixed budget.
 */
export const memoryGridEngine: GameEngine<
  MemoryGridState,
  MemoryGridMove,
  MemoryGridFeedback,
  MemoryGridConfig
> = {
  id: 'memory-grid',
  version: 1,

  createInitialState({ config, rng, startedAt }: CreateStateInput<MemoryGridConfig>): MemoryGridState {
    return {
      config,
      sequence: generateSequence(config, rng),
      entered: [],
      mistakes: 0,
      taps: 0,
      status: 'in_progress',
      startedAt,
      finishedAt: null,
    };
  },

  validateMove(state: MemoryGridState, move: MemoryGridMove): MoveValidation {
    if (state.status !== 'in_progress') {
      return invalid('game_over', 'This game has already finished.');
    }
    if (!isValidTile(move?.tile, state.config)) {
      return invalid('out_of_range', 'That tile is not on the grid.');
    }
    return VALID;
  },

  applyMove(
    state: MemoryGridState,
    move: MemoryGridMove,
    at: number,
  ): ApplyMoveResult<MemoryGridState, MemoryGridFeedback> {
    const expected = state.sequence[state.entered.length];
    const correct = move.tile === expected;

    const entered = correct ? [...state.entered, move.tile] : state.entered;
    const mistakes = correct ? state.mistakes : state.mistakes + 1;
    const taps = state.taps + 1;

    const solved = entered.length === state.config.sequenceLength;
    const exhausted = mistakes > state.config.maxMistakes;
    const status: GameStatus = solved ? 'won' : exhausted ? 'lost' : 'in_progress';

    const next: MemoryGridState = {
      ...state,
      entered,
      mistakes,
      taps,
      status,
      finishedAt: status === 'in_progress' ? null : at,
    };

    return {
      state: next,
      feedback: {
        tile: move.tile,
        correct,
        recalled: entered.length,
        sequenceLength: state.config.sequenceLength,
        mistakesLeft: Math.max(0, state.config.maxMistakes - mistakes),
        solved,
      },
    };
  },

  isTerminal: (state) => state.status !== 'in_progress',

  getOutcome(state: MemoryGridState, at: number): GameOutcome {
    const status = state.status === 'in_progress' ? 'abandoned' : state.status;
    const finishedAt = state.finishedAt ?? at;

    return {
      status,
      movesUsed: state.taps,
      maxMoves: tapBudget(state.config),
      durationMs: Math.max(0, finishedAt - state.startedAt),
      // Quality of play for a recall task is precision: what fraction of taps
      // landed. A perfect run is 1; every mistake dilutes it.
      accuracy: state.taps === 0 ? 0 : state.entered.length / state.taps,
      metrics: {
        sequenceLength: state.config.sequenceLength,
        gridSize: state.config.size,
        mistakes: state.mistakes,
        recalled: state.entered.length,
      },
    };
  },

  abandon(state: MemoryGridState, at: number): MemoryGridState {
    if (state.status !== 'in_progress') return state;
    return { ...state, status: 'abandoned', finishedAt: at };
  },

  revealSolution(state: MemoryGridState): string {
    if (state.status === 'in_progress') {
      throw new Error('revealSolution() called while the game is still in progress');
    }
    return state.sequence.join('-');
  },

  describeMove(move: MemoryGridMove, feedback: MemoryGridFeedback): string {
    return `${move.tile} → ${feedback.correct ? '✓' : '✕'}`;
  },
};

/** The tile the player must tap next, or null once the game is over. */
export function nextExpectedTile(state: MemoryGridState): number | null {
  if (state.status !== 'in_progress') return null;
  return state.sequence[state.entered.length] ?? null;
}
