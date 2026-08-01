import type { GameResult } from '@/engine/session';
import type { ScoreBreakdown } from '@/scoring/types';
import type { UserProfile } from '@/progress/types';

/**
 * Firestore document shapes and path builders.
 *
 * Paths live in one file so the app, the security rules and the Cloud Functions
 * can be checked against a single source of truth. See docs/DATABASE_SCHEMA.md
 * for the full model, indexes and access matrix.
 */

export const COLLECTIONS = {
  profiles: 'profiles',
  publicProfiles: 'publicProfiles',
  challenges: 'challenges',
  leaderboards: 'leaderboards',
  /** Subcollections */
  sessions: 'sessions',
  dailyEntries: 'dailyEntries',
  entries: 'entries',
} as const;

export const paths = {
  profile: (uid: string) => `${COLLECTIONS.profiles}/${uid}`,
  publicProfile: (uid: string) => `${COLLECTIONS.publicProfiles}/${uid}`,
  session: (uid: string, sessionId: string) =>
    `${COLLECTIONS.profiles}/${uid}/${COLLECTIONS.sessions}/${sessionId}`,
  sessions: (uid: string) => `${COLLECTIONS.profiles}/${uid}/${COLLECTIONS.sessions}`,
  dailyEntry: (uid: string, challengeId: string) =>
    `${COLLECTIONS.profiles}/${uid}/${COLLECTIONS.dailyEntries}/${challengeId}`,
  dailyEntries: (uid: string) => `${COLLECTIONS.profiles}/${uid}/${COLLECTIONS.dailyEntries}`,
  challenge: (dateKey: string) => `${COLLECTIONS.challenges}/${dateKey}`,
  leaderboard: (periodId: string) => `${COLLECTIONS.leaderboards}/${periodId}`,
  leaderboardEntries: (periodId: string) =>
    `${COLLECTIONS.leaderboards}/${periodId}/${COLLECTIONS.entries}`,
  leaderboardEntry: (periodId: string, uid: string) =>
    `${COLLECTIONS.leaderboards}/${periodId}/${COLLECTIONS.entries}/${uid}`,
} as const;

/** `leaderboards/global` is the all-time XP board. */
export const GLOBAL_LEADERBOARD_ID = 'global';

export type ProfileDoc = UserProfile;

/** Denormalised, world-readable slice of a profile. Written only by functions. */
export interface PublicProfileDoc {
  uid: string;
  displayName: string;
  avatarId: number;
  countryCode: string | null;
  level: number;
  xp: number;
  /** Translation key for the rank name; the client renders it. */
  titleKey: string;
  currentStreak: number;
  badgeCount: number;
  updatedAt: number;
}

export interface DailyChallengeDoc {
  id: string;
  date: string;
  moduleId: string;
  variantId: string;
  seed: string;
  createdAt: number;
  /** Aggregates incremented as results come in; purely for social proof. */
  stats: {
    played: number;
    solved: number;
    totalMoves: number;
    totalScore: number;
  };
}

export interface SessionDoc {
  sessionId: string;
  uid: string;
  moduleId: string;
  engineVersion: number;
  variantId: string;
  mode: GameResult['mode'];
  challengeId: string | null;
  seed: string;
  status: GameResult['outcome']['status'];
  movesUsed: number;
  maxMoves: number;
  durationMs: number;
  accuracy: number;
  score: number;
  xp: number;
  rating: ScoreBreakdown['rating'];
  /** Compact move log: `["82:+2", "56:0"]`. Enough to rebuild the history UI. */
  moveLog: string[];
  solution: string;
  startedAt: number;
  finishedAt: number;
  createdAt: number;
}

export interface DailyEntryDoc {
  challengeId: string;
  uid: string;
  sessionId: string;
  status: GameResult['outcome']['status'];
  score: number;
  xp: number;
  movesUsed: number;
  maxMoves: number;
  durationMs: number;
  moveLog: string[];
  finishedAt: number;
}

export interface LeaderboardEntryDoc {
  uid: string;
  displayName: string;
  avatarId: number;
  countryCode: string | null;
  /** XP for the global/weekly boards; game score for a daily board. */
  score: number;
  level: number;
  /** Daily boards only. */
  movesUsed?: number;
  durationMs?: number;
  updatedAt: number;
}

/**
 * There are deliberately no document *builders* here. Session, daily-entry and
 * leaderboard documents are constructed in one place only — the
 * `submitGameResult` Cloud Function — because the client is not trusted to
 * write them. This file describes the shapes the app reads back.
 */
