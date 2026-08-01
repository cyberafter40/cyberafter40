import { createRng } from './rng';
import { getGameModule, getVariant } from './registry';
import type {
  AnyGameModule,
  GameMode,
  GameOutcome,
  GameStatus,
  MoveValidation,
} from './types';

/** One applied move plus what the player learned from it. */
export interface MoveRecord {
  index: number;
  move: unknown;
  feedback: unknown;
  /** Milliseconds since the session started. */
  atMs: number;
  /** Pre-rendered summary for history rows and share cards. */
  label: string;
}

/**
 * The canonical, transport-ready description of a finished game. This is what
 * the scoring engine consumes, what gets written to Firestore, and what the
 * Cloud Function replays to verify a submission.
 */
export interface GameResult {
  sessionId: string;
  moduleId: string;
  engineVersion: number;
  variantId: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  mode: GameMode;
  /** Present for daily sessions; ties the result to a challenge document. */
  challengeId: string | null;
  seed: string;
  outcome: GameOutcome;
  startedAt: number;
  finishedAt: number;
  moves: MoveRecord[];
  solution: string;
}

export interface SessionInit {
  sessionId: string;
  moduleId: string;
  variantId: string;
  mode: GameMode;
  seed: string;
  challengeId?: string | null;
  /** Injectable clock. Defaults to `Date.now`; tests pass a fake. */
  now?: () => number;
}

export interface SubmitOutcome {
  accepted: boolean;
  validation: MoveValidation;
  feedback?: unknown;
  terminal: boolean;
}

/**
 * Runtime driver for any `GameEngine`.
 *
 * The UI talks to a `GameSession`, never to an engine directly. That keeps
 * screens free of game-specific plumbing: `submit()`, `history`, `status` and
 * `toResult()` mean the same thing for a number puzzle and for a future
 * memory-grid game.
 */
export class GameSession {
  readonly sessionId: string;
  readonly module: AnyGameModule;
  readonly variantId: string;
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
  readonly mode: GameMode;
  readonly challengeId: string | null;
  readonly seed: string;
  readonly startedAt: number;

  private state: unknown;
  private readonly records: MoveRecord[] = [];
  private readonly now: () => number;
  private finishedAt: number | null = null;

  constructor(init: SessionInit) {
    const module = getGameModule(init.moduleId);
    const variant = getVariant(init.moduleId, init.variantId);

    this.now = init.now ?? (() => Date.now());
    this.sessionId = init.sessionId;
    this.module = module;
    this.variantId = variant.id;
    this.difficulty = variant.difficulty;
    this.mode = init.mode;
    this.challengeId = init.challengeId ?? null;
    this.seed = init.seed;
    this.startedAt = this.now();

    this.state = module.engine.createInitialState({
      config: variant.config,
      rng: createRng(init.seed),
      startedAt: this.startedAt,
    });
  }

  get status(): GameStatus {
    if (!this.module.engine.isTerminal(this.state)) return 'in_progress';
    return this.module.engine.getOutcome(this.state, this.finishedAt ?? this.now()).status;
  }

  get isOver(): boolean {
    return this.module.engine.isTerminal(this.state);
  }

  get history(): readonly MoveRecord[] {
    return this.records;
  }

  get movesUsed(): number {
    return this.records.length;
  }

  /** Read-only snapshot for renderers. Never mutate the returned value. */
  getState<T = unknown>(): T {
    return this.state as T;
  }

  /** Checks a move without applying it — used to enable/disable the submit button. */
  validate(move: unknown): MoveValidation {
    if (this.isOver) {
      return { ok: false, code: 'game_over', message: 'This game has already finished.' };
    }
    return this.module.engine.validateMove(this.state, move);
  }

  submit(move: unknown): SubmitOutcome {
    const validation = this.validate(move);
    if (!validation.ok) {
      return { accepted: false, validation, terminal: this.isOver };
    }

    const at = this.now();
    const { state, feedback } = this.module.engine.applyMove(this.state, move, at);
    this.state = state;

    this.records.push({
      index: this.records.length,
      move,
      feedback,
      atMs: at - this.startedAt,
      label: this.module.engine.describeMove(move, feedback),
    });

    const terminal = this.module.engine.isTerminal(this.state);
    if (terminal) this.finishedAt = at;

    return { accepted: true, validation, feedback, terminal };
  }

  /** Player gave up. The session becomes terminal with an `abandoned` outcome. */
  abandon(): void {
    if (this.isOver) return;
    const at = this.now();
    this.state = this.module.engine.abandon(this.state, at);
    this.finishedAt = at;
  }

  getOutcome(): GameOutcome {
    return this.module.engine.getOutcome(this.state, this.finishedAt ?? this.now());
  }

  /** Available once the session is terminal. */
  revealSolution(): string {
    return this.module.engine.revealSolution(this.state);
  }

  toResult(): GameResult {
    if (!this.isOver) {
      throw new Error('toResult() called on a session that is still in progress');
    }
    const finishedAt = this.finishedAt ?? this.now();
    return {
      sessionId: this.sessionId,
      moduleId: this.module.id,
      engineVersion: this.module.engine.version,
      variantId: this.variantId,
      difficulty: this.difficulty,
      mode: this.mode,
      challengeId: this.challengeId,
      seed: this.seed,
      outcome: this.getOutcome(),
      startedAt: this.startedAt,
      finishedAt,
      moves: this.records,
      solution: this.revealSolution(),
    };
  }
}
