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
  /** Optimistically updated profile — safe to render immediately. */
  profile: UserProfile;
  /** False when the result was queued for a later retry. */
  synced: boolean;
}

export function scoreResult(result: GameResult, profile: UserProfile): ScoreBreakdown {
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
      level: profile.level,
      currentStreak: profile.streak.current,
      personalBest:
        profile.modules[result.moduleId]?.variants[result.variantId]?.bestScore ?? null,
    },
  });
}

export async function submitResult(input: {
  result: GameResult;
  profile: UserProfile;
}): Promise<SubmissionOutcome> {
  const { result, profile } = input;

  const score = scoreResult(result, profile);
  const { profile: nextProfile, events } = applyGameResult({ profile, result, score });

  await cacheProfile(nextProfile);
  trackCompletion(result, score, events);

  const synced = await pushToBackend(result);
  if (!synced) await enqueuePendingResult(result);

  return { score, events, profile: nextProfile, synced };
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
    const ok = await pushToBackend(item.result);
    if (ok) {
      sent += 1;
      await removePendingResult(item.result.sessionId);
    } else if (item.attempts + 1 < MAX_ATTEMPTS) {
      survivors.push({ ...item, attempts: item.attempts + 1 });
    }
  }

  await replacePendingResults(survivors);
  return { sent, remaining: survivors.length };
}

async function pushToBackend(result: GameResult): Promise<boolean> {
  try {
    const submit = httpsCallable(getFirebaseFunctions(), 'submitGameResult');
    await submit({ result });
    return true;
  } catch {
    return false;
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
