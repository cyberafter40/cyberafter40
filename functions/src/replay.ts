import { HttpsError } from 'firebase-functions/v2/https';
import { deriveDailyChallenge } from '@/daily/challenge';
import { getGameModule, getVariant } from '@/engine/registry';
import { createRng } from '@/engine/rng';
import type { GameResult } from '@/engine/session';
import type { GameOutcome } from '@/engine/types';

/**
 * Server-side replay and validation.
 *
 * A client submits what it *claims* happened. We never take that at face value:
 * the puzzle is regenerated from its seed and every move is replayed through
 * the exact same engine the app compiled from `../src/engine`. The outcome we
 * compute — not the one we were handed — is what gets scored.
 *
 * This closes the obvious attacks (fabricated wins, edited move counts, replayed
 * seeds from another day, impossibly fast solves). It does not defeat a
 * determined player running a solver against the real game; no client-side
 * puzzle game can, since the puzzle must exist on the device to be playable.
 * That residual risk is bounded by capping scores at what a perfect legitimate
 * game could earn and is documented in docs/ARCHITECTURE.md.
 */

/** Fastest a human could plausibly enter and submit one guess. */
const MIN_MS_PER_MOVE = 250;
/** Reject anything older than this — stale queues are fine, ancient ones are not. */
const MAX_RESULT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Tolerance for client/server clock skew. */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export interface ValidatedResult {
  result: GameResult;
  outcome: GameOutcome;
  solution: string;
}

export function validateAndReplay(raw: unknown, now: number): ValidatedResult {
  const result = assertShape(raw);

  const module = getGameModule(result.moduleId);
  const variant = getVariant(result.moduleId, result.variantId);

  if (module.engine.version !== result.engineVersion) {
    throw new HttpsError(
      'failed-precondition',
      'This result was produced by a different game version. Please update the app.',
    );
  }

  /* --- Seed integrity: a daily result must use today's derived seed. --- */
  if (result.mode === 'daily') {
    if (!result.challengeId) {
      throw new HttpsError('invalid-argument', 'Daily results must carry a challenge id.');
    }
    const expected = deriveDailyChallenge(result.challengeId, result.moduleId);
    if (expected.seed !== result.seed || expected.variantId !== result.variantId) {
      throw new HttpsError('permission-denied', 'Daily challenge does not match that date.');
    }
  }

  /* --- Timing sanity --- */
  if (result.finishedAt > now + MAX_CLOCK_SKEW_MS) {
    throw new HttpsError('invalid-argument', 'Result is timestamped in the future.');
  }
  if (now - result.finishedAt > MAX_RESULT_AGE_MS) {
    throw new HttpsError('invalid-argument', 'Result is too old to submit.');
  }
  if (result.finishedAt < result.startedAt) {
    throw new HttpsError('invalid-argument', 'Result finished before it started.');
  }
  if (result.finishedAt - result.startedAt < result.moves.length * MIN_MS_PER_MOVE) {
    throw new HttpsError('invalid-argument', 'Result was completed implausibly fast.');
  }

  /* --- Replay --- */
  let state = module.engine.createInitialState({
    config: variant.config,
    rng: createRng(result.seed),
    startedAt: result.startedAt,
  });

  let lastAt = result.startedAt;

  for (const [index, record] of result.moves.entries()) {
    if (module.engine.isTerminal(state)) {
      throw new HttpsError('invalid-argument', `Move ${index + 1} came after the game ended.`);
    }

    const validation = module.engine.validateMove(state, record.move);
    if (!validation.ok) {
      throw new HttpsError(
        'invalid-argument',
        `Move ${index + 1} is not legal: ${validation.code ?? 'rejected'}`,
      );
    }

    const at = result.startedAt + Math.max(0, Number(record.atMs) || 0);
    if (at < lastAt) {
      throw new HttpsError('invalid-argument', 'Moves are out of chronological order.');
    }
    lastAt = at;

    state = module.engine.applyMove(state, record.move, at).state;
  }

  if (!module.engine.isTerminal(state)) {
    // The player quit mid-game; record it as abandoned rather than rejecting.
    state = module.engine.abandon(state, result.finishedAt);
  }

  const outcome = module.engine.getOutcome(state, result.finishedAt);

  if (outcome.movesUsed !== result.moves.length) {
    throw new HttpsError('internal', 'Replay produced a different move count.');
  }

  return {
    // Overwrite the client's claims with the replayed truth.
    result: { ...result, outcome, solution: module.engine.revealSolution(state) },
    outcome,
    solution: module.engine.revealSolution(state),
  };
}

/** Structural validation before anything touches the engine. */
function assertShape(raw: unknown): GameResult {
  const value = raw as Partial<GameResult> | null;

  if (!value || typeof value !== 'object') {
    throw new HttpsError('invalid-argument', 'Missing result payload.');
  }

  const requiredStrings: (keyof GameResult)[] = ['sessionId', 'moduleId', 'variantId', 'seed'];
  for (const key of requiredStrings) {
    if (typeof value[key] !== 'string' || (value[key] as string).length === 0) {
      throw new HttpsError('invalid-argument', `Missing or invalid "${String(key)}".`);
    }
  }

  if (!['daily', 'classic', 'practice'].includes(value.mode as string)) {
    throw new HttpsError('invalid-argument', 'Unknown game mode.');
  }

  if (!Array.isArray(value.moves)) {
    throw new HttpsError('invalid-argument', 'Missing move log.');
  }
  if (value.moves.length > 64) {
    throw new HttpsError('invalid-argument', 'Move log is unreasonably long.');
  }

  if (typeof value.startedAt !== 'number' || typeof value.finishedAt !== 'number') {
    throw new HttpsError('invalid-argument', 'Missing timestamps.');
  }
  if (typeof value.engineVersion !== 'number') {
    throw new HttpsError('invalid-argument', 'Missing engine version.');
  }

  // Session ids become document ids — keep them boring.
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value.sessionId as string)) {
    throw new HttpsError('invalid-argument', 'Malformed session id.');
  }

  return value as GameResult;
}
