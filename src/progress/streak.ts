import { daysBetween, toDateKey, type DateKey } from '@/utils/date';
import type { ProgressEvent, StreakState } from './types';

/**
 * Streak rules.
 *
 * A streak counts *days on which the player completed at least one game*, in
 * UTC, matching the Daily Challenge boundary. Playing twice in one day does not
 * advance it; missing a day resets it to 1 (the current day still counts —
 * losing a 40-day streak and landing on zero is a reason to uninstall).
 *
 * A lost or abandoned game still counts as showing up. Consistency is the habit
 * we are training; correctness is what XP is for.
 */
export function applyStreak(
  streak: StreakState,
  finishedAt: number,
): { streak: StreakState; events: ProgressEvent[] } {
  const today: DateKey = toDateKey(finishedAt);
  const last = streak.lastPlayedDate;

  if (last === today) {
    // Already counted today — nothing changes.
    return { streak, events: [] };
  }

  if (!last) {
    const next: StreakState = {
      ...streak,
      current: 1,
      longest: Math.max(1, streak.longest),
      lastPlayedDate: today,
    };
    return { streak: next, events: [{ type: 'streak_started', current: 1 }] };
  }

  const gap = daysBetween(last, today);
  const events: ProgressEvent[] = [];

  // A clock skew or replayed old session must never rewind the streak.
  if (gap < 0) return { streak, events: [] };

  let current: number;
  if (gap === 1) {
    current = streak.current + 1;
  } else {
    if (streak.current > 1) events.push({ type: 'streak_broken', previous: streak.current });
    current = 1;
  }

  const longest = Math.max(streak.longest, current);
  events.push(
    current === 1 && gap !== 1
      ? { type: 'streak_started', current }
      : { type: 'streak_extended', current, isLongest: current >= longest },
  );

  return {
    streak: { ...streak, current, longest, lastPlayedDate: today },
    events,
  };
}

/**
 * Whether a streak is still alive right now — used by the home screen to show
 * "keep your 12-day streak alive" versus a dimmed flame.
 */
export function isStreakAtRisk(streak: StreakState, now: number = Date.now()): boolean {
  if (!streak.lastPlayedDate || streak.current === 0) return false;
  return daysBetween(streak.lastPlayedDate, toDateKey(now)) >= 1;
}

/** A streak that has already lapsed should display as 0, not as a stale number. */
export function effectiveStreak(streak: StreakState, now: number = Date.now()): number {
  if (!streak.lastPlayedDate) return 0;
  const gap = daysBetween(streak.lastPlayedDate, toDateKey(now));
  return gap <= 1 ? streak.current : 0;
}
