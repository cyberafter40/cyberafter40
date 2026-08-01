import { httpsCallable } from 'firebase/functions';
import type { GameResult } from '@/engine/session';
import { getGameModule } from '@/engine/registry';
import { applyGameResult } from '@/progress/progressEngine';
import type { ProgressEvent, UserProfile } from '@/progress/types';
import { computeScore } from '@/scoring/scoringEngine';
import { getScoringProfile } from '@/scoring/profiles';
import type { ScoreBreakdown } from '@/scoring/types';
import { track } from './analytics';
import { getFirebaseFunctions } from './firebase';
import {
  cacheProfile,
  enqueuePendingResult,
  readPendingResults,
  removePendingResult,
  replacePendingResults,
} from './storage';

/**
 * Result submission.
 *
 * The flow is deliberately optimistic-then-authoritative:
 *
 *  1. Score and progression are computed **locally** with the very same pure
 *     engines the backend runs, so the result screen animates instantly with
 *     the correct numbers — no spinner between finishing a puzzle and seeing
 *     the reward.
 *  2. The raw result is sent to `submitGameResult`, which replays the game from
 *     its seed, recomputes the score, and writes the profile, session, daily
 *     entry and leaderboard documents in one transaction.
 *  3. The profile snapshot listener overwrites the optimistic state with the
 *     server's. If the two ever disagree, the server wins silently.
 *
 * If step 2 fails the result is queued and retried; the player is never blocked
 * on the network.
 */

export interface SubmissionOutcome {
  score: ScoreBreakdown;
  events: ProgressEvent[];
  /**
   * Optimistically updated profile, or null when the profile had not loaded and
   * there was nothing to fold the result into. The server's write is
   * authoritative either way.
   */
  profile: UserProfile | null;
  /** False when the result was queued for a later retry, or rejected outright. */
  synced: boolean;
  /**
   * Set when the backend refused the result permanently. The optimistic profile
   * is still returned so the player sees their game, but the server will never
   * accept it and retrying is pointless — the UI should say so rather than
   * implying a sync is pending.
   */
  rejection: { code: string; message: string } | null;
}

type PushOutcome =
  | { ok: true }
  | { ok: false; permanent: boolean; code: string; message: string };

/**
 * Callable error codes that mean "this payload will never be accepted".
 * Anything else (network loss, `unavailable`, a cold start timing out) is worth
 * retrying, and only these are worth telling the player about.
 */
const PERMANENT_FAILURES = new Set([
  'invalid-argument',
  'permission-denied',
  'failed-precondition',
  'out-of-range',
]);

export function scoreResult(result: GameResult, profile: UserProfile | null): ScoreBreakdown {
  const module = getGameModule(result.moduleId);
  const scoringProfile = getScoringProfile(module.scoringProfileId);

  return computeScore(scoringProfile, {
    result,
    module: {
      id: module.id,
      basePoints: module.scoring.basePoints,
      difficultyStep: module.scoring.difficultyStep,
    },
    player: {
      // A null profile means it has not loaded yet (first launch on a slow
      // connection). Scoring against a neutral baseline keeps the result screen
      // truthful — no streak or personal-best bonus is claimed — and the server
      // recomputes the authoritative value from its own read regardless.
      level: profile?.level ?? 1,
      currentStreak: profile?.streak.current ?? 0,
      personalBest:
        profile?.modules[result.moduleId]?.variants[result.variantId]?.bestScore ?? null,
    },
  });
}

export async function submitResult(input: {
  result: GameResult;
  /**
   * The player's profile, or null if it has not loaded yet. A finished game is
   * never dropped for want of a profile: the backend is the authority and reads
   * its own copy, so the submission proceeds either way.
   */
  profile: UserProfile | null;
}): Promise<SubmissionOutcome> {
  const { result } = input;
  const profile = input.profile;

  const score = scoreResult(result, profile);
  const { profile: nextProfile, events } = profile
    ? applyGameResult({ profile, result, score })
    : { profile: null, events: [] as ProgressEvent[] };

  if (nextProfile) await cacheProfile(nextProfile);
  trackCompletion(result, score, events);

  const push = await pushToBackend(result);

  // A permanently rejected result must not be queued: retrying it forever
  // would keep the offline queue busy with a payload the server has already
  // refused, and would leave the player believing a sync is pending.
  if (!push.ok && !push.permanent) await enqueuePendingResult(result);

  return {
    score,
    events,
    profile: nextProfile,
    synced: push.ok,
    rejection: push.ok || !push.permanent ? null : { code: push.code, message: push.message },
  };
}

/**
 * Retries queued results. Called on app foreground and after a successful
 * sign-in. Entries that keep failing are dropped after `MAX_ATTEMPTS` so a
 * permanently rejected payload cannot wedge the queue forever.
 */
const MAX_ATTEMPTS = 5;

export async function flushPendingResults(): Promise<{ sent: number; remaining: number }> {
  const pending = await readPendingResults();
  if (pending.length === 0) return { sent: 0, remaining: 0 };

  let sent = 0;
  const survivors: typeof pending = [];

  for (const item of pending) {
    const push = await pushToBackend(item.result);
    if (push.ok || push.permanent) {
      // Permanently rejected entries are dropped rather than retried forever.
      if (push.ok) sent += 1;
      await removePendingResult(item.result.sessionId);
    } else if (item.attempts + 1 < MAX_ATTEMPTS) {
      survivors.push({ ...item, attempts: item.attempts + 1 });
    }
  }

  await replacePendingResults(survivors);
  return { sent, remaining: survivors.length };
}

async function pushToBackend(result: GameResult): Promise<PushOutcome> {
  try {
    const submit = httpsCallable(getFirebaseFunctions(), 'submitGameResult');
    await submit({ result });
    return { ok: true };
  } catch (error) {
    // Callable errors arrive as `functions/<code>`; normalise to the bare code.
    const raw = (error as { code?: string })?.code ?? 'unknown';
    const code = raw.replace(/^functions\//, '');
    const message = (error as { message?: string })?.message ?? 'Submission failed.';

    // Swallowing this silently is how a rejected result becomes invisible
    // progress. Log it even in production builds; it is low volume and it is
    // the only signal that scores are not reaching the backend.
    // eslint-disable-next-line no-console
    console.warn(`[MindCode] submitGameResult failed (${code}): ${message}`);

    return { ok: false, permanent: PERMANENT_FAILURES.has(code), code, message };
  }
}

function trackCompletion(
  result: GameResult,
  score: ScoreBreakdown,
  events: ProgressEvent[],
): void {
  track('game_complete', {
    moduleId: result.moduleId,
    variantId: result.variantId,
    mode: result.mode,
    status: result.outcome.status,
    movesUsed: result.outcome.movesUsed,
    durationMs: result.outcome.durationMs,
    score: score.total,
    xp: score.xp,
  });

  if (result.mode === 'daily' && result.challengeId) {
    track('daily_challenge_complete', {
      challengeId: result.challengeId,
      score: score.total,
      status: result.outcome.status,
    });
  }

  for (const event of events) {
    if (event.type === 'level_up') track('level_up', { level: event.to, title: event.title });
    if (event.type === 'badge_unlocked') track('badge_unlocked', { badgeId: event.badgeId });
    if (event.type === 'streak_extended') track('streak_extended', { current: event.current });
    if (event.type === 'streak_broken') track('streak_broken', { previous: event.previous });
  }
}
