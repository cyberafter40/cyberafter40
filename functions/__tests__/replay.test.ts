import { GameSession, type GameResult, type MoveRecord } from '@/engine/session';
import { getVariant } from '@/engine/registry';
import { createRng } from '@/engine/rng';
import { deriveDailyChallenge } from '@/daily/challenge';
import { registerAllGameModules } from '@/games';
import { generateSecret } from '@/games/numberLogic/generator';
import type { NumberLogicState } from '@/games/numberLogic/engine';
import { validateAndReplay } from '../src/replay';

/**
 * Server-side validation is the only thing standing between a modified client
 * and a fabricated leaderboard, so it gets tested against real games rather
 * than hand-written fixtures: every case below is produced by driving the same
 * `GameSession` the app uses, then tampering with the payload the way an
 * attacker would.
 */

registerAllGameModules();

const NOW = Date.UTC(2026, 7, 1, 12, 0, 0);
const CHALLENGE_ID = '2026-08-01';

/** Plays a real game with a controllable clock and returns its `GameResult`. */
function playGame(options: {
  mode?: 'classic' | 'daily';
  challengeId?: string | null;
  seed?: string;
  variantId?: string;
  /** Guesses to make before solving. Omit to solve immediately. */
  wrongGuesses?: string[];
  /** Deliberately lose by exhausting the attempt budget. */
  lose?: boolean;
  /** Milliseconds between moves. */
  pace?: number;
  startedAt?: number;
} = {}): GameResult {
  const mode = options.mode ?? 'daily';
  const daily = deriveDailyChallenge(CHALLENGE_ID);
  const variantId = options.variantId ?? daily.variantId;
  const seed = options.seed ?? daily.seed;
  const pace = options.pace ?? 8_000;

  let clock = options.startedAt ?? NOW - 120_000;
  const session = new GameSession({
    sessionId: `user1_${CHALLENGE_ID}`,
    moduleId: 'number-logic',
    variantId,
    mode,
    seed,
    challengeId: options.challengeId === undefined ? (mode === 'daily' ? CHALLENGE_ID : null) : options.challengeId,
    now: () => {
      const at = clock;
      clock += pace;
      return at;
    },
  });

  const state = session.getState<NumberLogicState>();
  const secret = state.secret;

  if (options.lose) {
    const wrong = allCodes(state).filter((code) => code !== secret);
    for (let i = 0; i < state.config.maxAttempts; i += 1) {
      session.submit({ guess: wrong[i] as string });
    }
  } else {
    for (const guess of options.wrongGuesses ?? []) {
      if (guess !== secret) session.submit({ guess });
    }
    session.submit({ guess: secret });
  }

  return session.toResult();
}

function allCodes(state: NumberLogicState): string[] {
  const digits = '0123456789'.split('');
  const out: string[] = [];
  for (const a of digits) {
    for (const b of digits) {
      if (a !== b) out.push(a + b);
    }
  }
  return state.config.digits === 2 ? out : out.map((code) => `${code}0`);
}

describe('validateAndReplay — legitimate play', () => {
  it('accepts a real winning Daily Challenge', () => {
    const result = playGame();
    const validated = validateAndReplay(result, NOW);

    expect(validated.outcome.status).toBe('won');
    expect(validated.outcome.movesUsed).toBe(result.outcome.movesUsed);
    expect(validated.solution).toBe(result.solution);
  });

  it('re-derives the same secret the client played against', () => {
    const daily = deriveDailyChallenge(CHALLENGE_ID);
    const variant = getVariant(daily.moduleId, daily.variantId);
    const expected = generateSecret(variant.config, createRng(daily.seed));

    expect(validateAndReplay(playGame(), NOW).solution).toBe(expected);
  });

  it('accepts a legitimate loss', () => {
    const validated = validateAndReplay(playGame({ lose: true }), NOW);
    expect(validated.outcome.status).toBe('lost');
  });

  it('accepts a classic (non-daily) game on an arbitrary seed', () => {
    const result = playGame({ mode: 'classic', seed: 'classic:user1:12345', challengeId: null });
    expect(validateAndReplay(result, NOW).outcome.status).toBe('won');
  });

  it('records an unfinished game as abandoned rather than rejecting it', () => {
    const result = playGame();
    // Drop the winning move, as an app killed mid-game would.
    const partial: GameResult = {
      ...result,
      moves: result.moves.slice(0, Math.max(0, result.moves.length - 1)),
    };

    expect(validateAndReplay(partial, NOW).outcome.status).toBe('abandoned');
  });
});

describe('validateAndReplay — forged results', () => {
  it('discards the client’s claimed outcome in favour of the replay', () => {
    const lost = playGame({ lose: true });
    const forged: GameResult = {
      ...lost,
      // Claim a flawless win while submitting the moves of a game that lost.
      outcome: { ...lost.outcome, status: 'won', movesUsed: 1, accuracy: 1 },
      solution: '00',
    };

    // The lie is not rejected, it is simply overwritten — which is the stronger
    // property, because it means no forged field can ever reach the scorer.
    const validated = validateAndReplay(forged, NOW);

    expect(validated.outcome.status).toBe('lost');
    expect(validated.outcome.movesUsed).toBe(lost.outcome.movesUsed);
    expect(validated.outcome.accuracy).toBeCloseTo(lost.outcome.accuracy, 6);
    expect(validated.solution).toBe(lost.solution);
    // And the sanitised result — not the submitted one — is what gets scored.
    expect(validated.result.outcome).toEqual(validated.outcome);
  });

  it('discards a forged solution even when the game genuinely was won', () => {
    const won = playGame();
    const forged: GameResult = { ...won, solution: '99', seed: won.seed };

    expect(validateAndReplay(forged, NOW).result.solution).toBe(won.solution);
  });

  it('rejects a win claimed with no moves at all', () => {
    const result = playGame();
    const forged: GameResult = { ...result, moves: [] };

    // Replaying zero moves cannot reach a terminal win.
    expect(validateAndReplay(forged, NOW).outcome.status).toBe('abandoned');
  });

  it('rejects a daily seed that does not belong to the claimed date', () => {
    const result = playGame({ seed: deriveDailyChallenge('2026-07-25').seed });
    expect(() => validateAndReplay(result, NOW)).toThrow(/does not match that date/);
  });

  it('rejects a daily result with no challenge id', () => {
    const result = playGame();
    expect(() => validateAndReplay({ ...result, challengeId: null }, NOW)).toThrow(
      /must carry a challenge id/,
    );
  });

  it('rejects a variant swapped for an easier one', () => {
    const daily = deriveDailyChallenge(CHALLENGE_ID);
    const other = daily.variantId === 'two-digit' ? 'three-digit' : 'two-digit';
    const result = playGame({ variantId: other });

    expect(() => validateAndReplay(result, NOW)).toThrow(/does not match that date/);
  });

  it('rejects an illegal move sequence', () => {
    const result = playGame({ wrongGuesses: ['12'] });
    const first = result.moves[0] as MoveRecord;
    const duplicated: GameResult = { ...result, moves: [first, { ...first, index: 1 }] };

    expect(() => validateAndReplay(duplicated, NOW)).toThrow(/is not legal/);
  });

  it('rejects moves submitted after the game already ended', () => {
    const result = playGame();
    const first = result.moves[0] as MoveRecord;
    const extra: GameResult = {
      ...result,
      moves: [
        ...result.moves,
        { ...first, index: result.moves.length, move: { guess: '97' }, atMs: first.atMs + 1_000 },
      ],
    };

    expect(() => validateAndReplay(extra, NOW)).toThrow(/came after the game ended/);
  });

  it('rejects moves that are out of chronological order', () => {
    const result = playGame({ wrongGuesses: ['12', '34'] });
    const shuffled: GameResult = {
      ...result,
      moves: result.moves.map((move, index) => ({
        ...move,
        atMs: index === 0 ? 90_000 : 1_000,
      })),
    };

    expect(() => validateAndReplay(shuffled, NOW)).toThrow(/chronological order/);
  });
});

describe('validateAndReplay — timing', () => {
  it('rejects an implausibly fast solve', () => {
    const result = playGame({ wrongGuesses: ['12', '34', '56'] });
    const instant: GameResult = { ...result, finishedAt: result.startedAt + 10 };

    expect(() => validateAndReplay(instant, NOW)).toThrow(/implausibly fast/);
  });

  it('rejects a result timestamped in the future', () => {
    const result = playGame();
    const future: GameResult = {
      ...result,
      startedAt: NOW + 3_600_000,
      finishedAt: NOW + 3_700_000,
    };

    expect(() => validateAndReplay(future, NOW)).toThrow(/in the future/);
  });

  it('rejects a result older than the retry window', () => {
    const result = playGame();
    expect(() => validateAndReplay(result, NOW + 8 * 24 * 60 * 60 * 1000)).toThrow(/too old/);
  });

  it('rejects a game that finished before it started', () => {
    const result = playGame();
    const reversed: GameResult = { ...result, finishedAt: result.startedAt - 1 };

    expect(() => validateAndReplay(reversed, NOW)).toThrow(/finished before it started/);
  });

  it('tolerates modest clock skew', () => {
    const result = playGame();
    const skewed: GameResult = {
      ...result,
      startedAt: NOW + 60_000,
      finishedAt: NOW + 180_000,
    };

    expect(validateAndReplay(skewed, NOW).outcome.status).toBe('won');
  });
});

describe('validateAndReplay — malformed payloads', () => {
  const base = () => playGame();

  it('rejects a missing payload', () => {
    expect(() => validateAndReplay(undefined, NOW)).toThrow(/Missing result payload/);
    expect(() => validateAndReplay(null, NOW)).toThrow(/Missing result payload/);
    expect(() => validateAndReplay('not-an-object', NOW)).toThrow(/Missing result payload/);
  });

  it('rejects missing required identifiers', () => {
    for (const field of ['sessionId', 'moduleId', 'variantId', 'seed'] as const) {
      expect(() => validateAndReplay({ ...base(), [field]: '' }, NOW)).toThrow(
        new RegExp(`Missing or invalid "${field}"`),
      );
    }
  });

  it('rejects an unknown game mode', () => {
    expect(() => validateAndReplay({ ...base(), mode: 'freeplay' }, NOW)).toThrow(
      /Unknown game mode/,
    );
  });

  it('rejects a session id that is not safe as a document id', () => {
    expect(() => validateAndReplay({ ...base(), sessionId: 'a/b' }, NOW)).toThrow(
      /Malformed session id/,
    );
    expect(() => validateAndReplay({ ...base(), sessionId: 'x'.repeat(200) }, NOW)).toThrow(
      /Malformed session id/,
    );
  });

  it('rejects an unreasonably long move log before replaying it', () => {
    const result = base();
    const first = result.moves[0] as MoveRecord;
    const flood: GameResult = {
      ...result,
      moves: Array.from({ length: 500 }, (_, index) => ({ ...first, index })),
    };

    expect(() => validateAndReplay(flood, NOW)).toThrow(/unreasonably long/);
  });

  it('rejects a missing move log or timestamps', () => {
    expect(() => validateAndReplay({ ...base(), moves: undefined }, NOW)).toThrow(
      /Missing move log/,
    );
    expect(() => validateAndReplay({ ...base(), finishedAt: 'soon' }, NOW)).toThrow(
      /Missing timestamps/,
    );
  });

  it('rejects a result from an incompatible engine version', () => {
    expect(() => validateAndReplay({ ...base(), engineVersion: 99 }, NOW)).toThrow(
      /different game version/,
    );
    expect(() => validateAndReplay({ ...base(), engineVersion: undefined }, NOW)).toThrow(
      /Missing engine version/,
    );
  });

  it('rejects an unknown game module', () => {
    expect(() => validateAndReplay({ ...base(), moduleId: 'not-a-game' }, NOW)).toThrow(
      /Unknown game module/,
    );
  });
});
