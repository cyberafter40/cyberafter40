import type { DateKey } from '@/utils/date';

/**
 * The user progress model.
 *
 * This is also the shape of the `profiles/{uid}` Firestore document (see
 * docs/DATABASE_SCHEMA.md). Stats are stored pre-aggregated rather than derived
 * from the session log because the profile screen must render instantly and
 * offline, and because counting thousands of session documents on every open
 * would be both slow and expensive.
 */

export interface VariantStats {
  played: number;
  won: number;
  totalScore: number;
  bestScore: number;
  /** Fewest moves in a winning game. 0 until the first win. */
  bestMoves: number;
  totalMoves: number;
  totalDurationMs: number;
}

export interface ModuleStats {
  played: number;
  won: number;
  totalScore: number;
  bestScore: number;
  totalMoves: number;
  totalDurationMs: number;
  variants: Record<string, VariantStats>;
}

export interface GlobalStats {
  played: number;
  won: number;
  /** Total guesses across every game — "number of attempts". */
  totalMoves: number;
  totalScore: number;
  bestScore: number;
  totalDurationMs: number;
  /** Daily Challenges completed, all-time. */
  dailyCompleted: number;
  /** Games won without a single wasted guess. */
  flawlessWins: number;
  /** Consecutive wins right now — resets on any loss. */
  currentWinRun: number;
  longestWinRun: number;
}

export interface StreakState {
  current: number;
  longest: number;
  /** UTC date key of the last day a game was completed. */
  lastPlayedDate: DateKey | null;
  /** Days the streak has survived a gap using a freeze. Reserved for v1.1. */
  freezesUsed: number;
}

export interface BadgeAward {
  id: string;
  unlockedAt: number;
  /** Snapshot of what triggered it, for the badge detail sheet. */
  context?: string;
}

export interface UserSettings {
  haptics: boolean;
  reducedMotion: boolean;
  dailyReminder: boolean;
  theme: 'system' | 'light' | 'dark';
}

export interface UserProfile {
  uid: string;
  displayName: string;
  /** Index into the built-in avatar set — no image uploads in v1. */
  avatarId: number;
  countryCode: string | null;
  isAnonymous: boolean;
  createdAt: number;
  updatedAt: number;

  xp: number;
  level: number;

  streak: StreakState;
  stats: GlobalStats;
  modules: Record<string, ModuleStats>;
  badges: Record<string, BadgeAward>;
  settings: UserSettings;

  /** Schema version, so migrations can run on read. */
  schemaVersion: number;
}

export type ProgressEvent =
  | { type: 'xp_gained'; amount: number; total: number }
  | { type: 'level_up'; from: number; to: number; title: string }
  | { type: 'badge_unlocked'; badgeId: string; title: string; description: string }
  | { type: 'streak_extended'; current: number; isLongest: boolean }
  | { type: 'streak_started'; current: number }
  | { type: 'streak_broken'; previous: number }
  | { type: 'personal_best'; scope: 'global' | 'variant'; score: number };

export interface ProgressUpdate {
  profile: UserProfile;
  events: ProgressEvent[];
}

export const PROFILE_SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: UserSettings = {
  haptics: true,
  reducedMotion: false,
  dailyReminder: true,
  theme: 'system',
};

export function emptyGlobalStats(): GlobalStats {
  return {
    played: 0,
    won: 0,
    totalMoves: 0,
    totalScore: 0,
    bestScore: 0,
    totalDurationMs: 0,
    dailyCompleted: 0,
    flawlessWins: 0,
    currentWinRun: 0,
    longestWinRun: 0,
  };
}

export function emptyVariantStats(): VariantStats {
  return {
    played: 0,
    won: 0,
    totalScore: 0,
    bestScore: 0,
    bestMoves: 0,
    totalMoves: 0,
    totalDurationMs: 0,
  };
}

export function emptyModuleStats(): ModuleStats {
  return {
    played: 0,
    won: 0,
    totalScore: 0,
    bestScore: 0,
    totalMoves: 0,
    totalDurationMs: 0,
    variants: {},
  };
}

export function createProfile(input: {
  uid: string;
  displayName: string;
  isAnonymous: boolean;
  now: number;
  avatarId?: number;
  countryCode?: string | null;
}): UserProfile {
  return {
    uid: input.uid,
    displayName: input.displayName,
    avatarId: input.avatarId ?? 0,
    countryCode: input.countryCode ?? null,
    isAnonymous: input.isAnonymous,
    createdAt: input.now,
    updatedAt: input.now,
    xp: 0,
    level: 1,
    streak: { current: 0, longest: 0, lastPlayedDate: null, freezesUsed: 0 },
    stats: emptyGlobalStats(),
    modules: {},
    badges: {},
    settings: { ...DEFAULT_SETTINGS },
    schemaVersion: PROFILE_SCHEMA_VERSION,
  };
}

/* ---------- Derived metrics ---------- */

/** Average score per completed game — the profile's headline "average". */
export function averageScore(stats: GlobalStats): number {
  return stats.played === 0 ? 0 : Math.round(stats.totalScore / stats.played);
}

/** Average guesses per game — the other half of "how good am I?". */
export function averageMoves(stats: GlobalStats): number {
  return stats.played === 0 ? 0 : Number((stats.totalMoves / stats.played).toFixed(2));
}

export function winRate(stats: GlobalStats): number {
  return stats.played === 0 ? 0 : stats.won / stats.played;
}

export function averageDurationMs(stats: GlobalStats): number {
  return stats.played === 0 ? 0 : Math.round(stats.totalDurationMs / stats.played);
}
