import type { GameResult } from '@/engine/session';
import type { ScoreBreakdown } from '@/scoring/types';
import { evaluateBadges } from './badges';
import { describeLevel, levelForXp, levelTitleKey } from './levels';
import { applyStreak } from './streak';
import {
  emptyModuleStats,
  emptyVariantStats,
  type ModuleStats,
  type ProgressEvent,
  type ProgressUpdate,
  type UserProfile,
  type VariantStats,
} from './types';

/**
 * The User Progress Engine.
 *
 * One pure reducer: `(profile, result, score) → (profile', events)`. It owns XP,
 * levels, streaks, aggregate statistics and badge unlocks, and it knows nothing
 * about how any game is played — it reads only the normalised `GameResult` and
 * `ScoreBreakdown`.
 *
 * Purity matters operationally: the identical function runs client-side for an
 * instant optimistic UI and inside the `submitGameResult` Cloud Function as the
 * authoritative writer, so the two can never disagree.
 */
export function applyGameResult(input: {
  profile: UserProfile;
  result: GameResult;
  score: ScoreBreakdown;
  /** Player's local hour, for time-of-day badges. */
  localHour?: number;
  now?: number;
}): ProgressUpdate {
  const { result, score } = input;
  const now = input.now ?? Date.now();
  const events: ProgressEvent[] = [];

  const won = result.outcome.status === 'won';
  const { movesUsed, durationMs } = result.outcome;

  /* ---- Statistics ---- */
  const prevStats = input.profile.stats;
  const currentWinRun = won ? prevStats.currentWinRun + 1 : 0;

  const stats = {
    ...prevStats,
    played: prevStats.played + 1,
    won: prevStats.won + (won ? 1 : 0),
    totalMoves: prevStats.totalMoves + movesUsed,
    totalScore: prevStats.totalScore + score.total,
    bestScore: Math.max(prevStats.bestScore, score.total),
    totalDurationMs: prevStats.totalDurationMs + durationMs,
    dailyCompleted: prevStats.dailyCompleted + (result.mode === 'daily' && won ? 1 : 0),
    flawlessWins: prevStats.flawlessWins + (won && score.rating === 'flawless' ? 1 : 0),
    currentWinRun,
    longestWinRun: Math.max(prevStats.longestWinRun, currentWinRun),
  };

  if (score.total > prevStats.bestScore && score.total > 0) {
    events.push({ type: 'personal_best', scope: 'global', score: score.total });
  }

  /* ---- Per-module / per-variant breakdown ---- */
  const modules = { ...input.profile.modules };
  const moduleStats = updateModuleStats(
    modules[result.moduleId] ?? emptyModuleStats(),
    result,
    score,
  );
  modules[result.moduleId] = moduleStats;

  const prevVariantBest =
    input.profile.modules[result.moduleId]?.variants[result.variantId]?.bestScore ?? 0;
  if (score.total > prevVariantBest && score.total > 0 && prevVariantBest > 0) {
    events.push({ type: 'personal_best', scope: 'variant', score: score.total });
  }

  /* ---- XP and level ---- */
  const xp = input.profile.xp + score.xp;
  const level = levelForXp(xp);
  if (score.xp > 0) events.push({ type: 'xp_gained', amount: score.xp, total: xp });
  if (level > input.profile.level) {
    events.push({
      type: 'level_up',
      from: input.profile.level,
      to: level,
      titleKey: levelTitleKey(level),
    });
  }

  /* ---- Streak ---- */
  const streakUpdate = applyStreak(input.profile.streak, result.finishedAt);
  events.push(...streakUpdate.events);

  /* ---- Assemble, then evaluate badges against the *new* profile ---- */
  const updated: UserProfile = {
    ...input.profile,
    xp,
    level,
    stats,
    modules,
    streak: streakUpdate.streak,
    updatedAt: now,
  };

  const localHour = input.localHour ?? new Date(result.finishedAt).getHours();
  const unlocked = evaluateBadges({ profile: updated, result, score, localHour });

  if (unlocked.length > 0) {
    const badges = { ...updated.badges };
    for (const badge of unlocked) {
      badges[badge.id] = { id: badge.id, unlockedAt: now };
      events.push({
        type: 'badge_unlocked',
        badgeId: badge.id,
        titleKey: badge.titleKey,
        descriptionKey: badge.descriptionKey,
      });
    }
    updated.badges = badges;
  }

  return { profile: updated, events };
}

function updateModuleStats(
  prev: ModuleStats,
  result: GameResult,
  score: ScoreBreakdown,
): ModuleStats {
  const won = result.outcome.status === 'won';
  const { movesUsed, durationMs } = result.outcome;

  const variants = { ...prev.variants };
  variants[result.variantId] = updateVariantStats(
    variants[result.variantId] ?? emptyVariantStats(),
    result,
    score,
  );

  return {
    played: prev.played + 1,
    won: prev.won + (won ? 1 : 0),
    totalScore: prev.totalScore + score.total,
    bestScore: Math.max(prev.bestScore, score.total),
    totalMoves: prev.totalMoves + movesUsed,
    totalDurationMs: prev.totalDurationMs + durationMs,
    variants,
  };
}

function updateVariantStats(
  prev: VariantStats,
  result: GameResult,
  score: ScoreBreakdown,
): VariantStats {
  const won = result.outcome.status === 'won';
  const { movesUsed, durationMs } = result.outcome;

  return {
    played: prev.played + 1,
    won: prev.won + (won ? 1 : 0),
    totalScore: prev.totalScore + score.total,
    bestScore: Math.max(prev.bestScore, score.total),
    // `bestMoves` is a minimum, so 0 means "no win yet" rather than "zero moves".
    bestMoves: won ? (prev.bestMoves === 0 ? movesUsed : Math.min(prev.bestMoves, movesUsed)) : prev.bestMoves,
    totalMoves: prev.totalMoves + movesUsed,
    totalDurationMs: prev.totalDurationMs + durationMs,
  };
}

/** Convenience for the profile header. */
export function profileSummary(profile: UserProfile) {
  const level = describeLevel(profile.xp);
  return {
    ...level,
    xp: profile.xp,
    badgeCount: Object.keys(profile.badges).length,
  };
}
