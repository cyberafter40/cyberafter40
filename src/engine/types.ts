/**
 * MindCode generic game engine contracts.
 *
 * Nothing in this file knows what Bulls & Cows is. A `GameEngine` is a pure
 * state machine: it turns (state, move) into (state', feedback) and reports
 * when it is finished. The number-guessing game in `src/games/numberLogic` is
 * one implementation; memory, pattern, reaction and reasoning modules will be
 * others, and the app shell, scoring engine, progress engine, persistence layer
 * and analytics do not change when they are added.
 *
 * Rules for implementers:
 *  - Engines must be PURE. No I/O, no Date.now() reads (time is passed in), no
 *    Math.random() (use the seeded Rng). This is what lets the server replay a
 *    session to validate it.
 *  - State must be JSON-serialisable so a session can be suspended, stored in
 *    Firestore and resumed on another device.
 */

import type { TranslationKey, TranslationParams } from '@/i18n/types';
import type { Rng } from './rng';

export type GameCategory =
  | 'logic'
  | 'memory'
  | 'pattern'
  | 'reaction'
  | 'reasoning';

/** How a session was started — affects scoring and where results are written. */
export type GameMode = 'classic' | 'daily' | 'practice';

export type GameStatus = 'in_progress' | 'won' | 'lost' | 'abandoned';

/**
 * Result of checking a move before it is applied.
 *
 * Rejections carry a translation key, never a sentence: engines are pure and
 * replayed server-side, and neither a pure function nor a Cloud Function has any
 * business deciding what language a player reads.
 */
export interface MoveValidation {
  ok: boolean;
  /** Machine-readable code, e.g. `length_mismatch`. */
  code?: string;
  /** Key for the message shown in the UI; the renderer translates it. */
  messageKey?: TranslationKey;
  /** Values interpolated into the message, e.g. `{ digits: 3 }`. */
  messageParams?: TranslationParams;
}

export const VALID: MoveValidation = { ok: true };

export function invalid(
  code: string,
  messageKey: TranslationKey,
  messageParams?: TranslationParams,
): MoveValidation {
  return messageParams
    ? { ok: false, code, messageKey, messageParams }
    : { ok: false, code, messageKey };
}

export interface ApplyMoveResult<TState, TFeedback> {
  state: TState;
  feedback: TFeedback;
}

/**
 * Normalised description of how a finished game went. This is the ONLY thing
 * the scoring engine sees, which is why a new game module needs zero scoring
 * changes to work.
 */
export interface GameOutcome {
  status: Exclude<GameStatus, 'in_progress'>;
  /** Moves the player actually spent. */
  movesUsed: number;
  /** Move budget for this variant. */
  maxMoves: number;
  durationMs: number;
  /**
   * Normalised 0..1 quality of play, engine-defined. For the number game this
   * is how efficiently the search space was narrowed; for a reaction test it
   * would be hit rate. Scoring rules read this, never engine internals.
   */
  accuracy: number;
  /** Free-form engine metrics, surfaced in stats and analytics. */
  metrics: Record<string, number>;
}

export interface CreateStateInput<TConfig> {
  config: TConfig;
  /** Seeded RNG — the only randomness source an engine may use. */
  rng: Rng;
  /** Epoch ms, injected so engines stay pure. */
  startedAt: number;
}

/**
 * A self-contained, replayable game rule set.
 *
 * @typeParam TState    Full game state (JSON-serialisable).
 * @typeParam TMove     A single player action.
 * @typeParam TFeedback What the player learns from that action.
 * @typeParam TConfig   Variant configuration (difficulty knobs).
 */
export interface GameEngine<
  TState = unknown,
  TMove = unknown,
  TFeedback = unknown,
  TConfig = unknown,
> {
  readonly id: string;
  /**
   * Bumped whenever rules change in a way that invalidates stored sessions.
   * Persisted alongside results so old data stays interpretable.
   */
  readonly version: number;

  createInitialState(input: CreateStateInput<TConfig>): TState;

  validateMove(state: TState, move: TMove): MoveValidation;

  /** Called only after `validateMove` returns ok. `at` is epoch ms. */
  applyMove(state: TState, move: TMove, at: number): ApplyMoveResult<TState, TFeedback>;

  isTerminal(state: TState): boolean;

  getOutcome(state: TState, at: number): GameOutcome;

  /** Marks the game as given up without revealing anything else. */
  abandon(state: TState, at: number): TState;

  /**
   * The answer, for the post-game reveal. Implementations must refuse to
   * return it while the game is still in progress.
   */
  revealSolution(state: TState): string;

  /** A short human summary of a move, used in history rows and share cards. */
  describeMove(move: TMove, feedback: TFeedback): string;
}

/** One difficulty/shape option inside a module, e.g. "3 digits". */
export interface GameVariant<TConfig = unknown> {
  id: string;
  /** Translation key for the display name, e.g. `variants.twoDigit`. */
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  config: TConfig;
  /** 1 (easiest) .. 5. Feeds the scoring engine's difficulty multiplier. */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Gate behind a level so early users aren't overwhelmed. 0 = always open. */
  unlocksAtLevel: number;
}

/**
 * Everything the app needs to present and run a game type. Registering a module
 * is the entire integration surface for a new brain-training game.
 */
export interface GameModule<
  TState = unknown,
  TMove = unknown,
  TFeedback = unknown,
  TConfig = unknown,
> {
  id: string;
  /** Translation key for the display name, e.g. `modules.numberLogic`. */
  titleKey: TranslationKey;
  taglineKey: TranslationKey;
  category: GameCategory;
  /** Emoji or icon token used by the UI. */
  icon: string;
  /** `live` modules are playable; `coming_soon` render as locked teasers. */
  status: 'live' | 'coming_soon';
  engine: GameEngine<TState, TMove, TFeedback, TConfig>;
  variants: GameVariant<TConfig>[];
  /** Which variant the Daily Challenge rotates through, by variant id. */
  dailyVariantPool: string[];
  /** Registered play-surface component key (see src/games/renderers.tsx). */
  renderer: string;
  /** Id of the `ScoringProfile` this module is scored with (see src/scoring). */
  scoringProfileId: string;
  /** Base score weight — see src/scoring. */
  scoring: {
    basePoints: number;
    /** Multiplier applied per difficulty step above 1. */
    difficultyStep: number;
  };
}

/** Convenience alias for collections that hold modules of mixed generics. */
export type AnyGameModule = GameModule<any, any, any, any>;
export type AnyGameEngine = GameEngine<any, any, any, any>;
