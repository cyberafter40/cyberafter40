import { buildSeed, createRng } from '@/engine/rng';
import { getGameModule } from '@/engine/registry';
import { DEFAULT_MODULE_ID } from '@/games';
import { toDateKey, type DateKey } from '@/utils/date';

/**
 * Daily Challenge derivation — shared verbatim by the app and the Cloud
 * Functions (see functions/tsconfig.json).
 *
 * Everything about today's challenge is a pure function of its UTC date key, so
 * every player in the world gets the same puzzle, the app can compute it while
 * offline, and the backend can re-derive it to validate a submitted result.
 */

/**
 * Rotates the seed space. Bumping this in a future release would reshuffle all
 * future puzzles without changing the code — useful if a generation flaw is
 * ever found. Past challenges must keep their salt to stay reproducible.
 */
export const DAILY_SEED_SALT = 'mindcode.v1';

export interface DailyChallenge {
  /** Equals the UTC date key — also the Firestore document id. */
  id: DateKey;
  date: DateKey;
  moduleId: string;
  variantId: string;
  seed: string;
}

export function deriveDailyChallenge(
  dateKey: DateKey,
  moduleId: string = DEFAULT_MODULE_ID,
): DailyChallenge {
  const module = getGameModule(moduleId);
  const pool =
    module.dailyVariantPool.length > 0
      ? module.dailyVariantPool
      : module.variants.map((v) => v.id);

  const rng = createRng(buildSeed(DAILY_SEED_SALT, 'variant', dateKey, moduleId));
  const variantId = rng.pick(pool);

  return {
    id: dateKey,
    date: dateKey,
    moduleId,
    variantId,
    seed: buildSeed(DAILY_SEED_SALT, 'daily', dateKey, moduleId, variantId),
  };
}

export function todaysChallenge(now: number = Date.now()): DailyChallenge {
  return deriveDailyChallenge(toDateKey(now));
}

/** Deterministic session id so a daily attempt can never be double-counted. */
export function dailySessionId(uid: string, challengeId: string): string {
  return `${uid}_${challengeId}`;
}
