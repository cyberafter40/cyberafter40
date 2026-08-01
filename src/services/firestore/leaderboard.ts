import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
} from 'firebase/firestore';
import { toDateKey, toWeekKey } from '@/utils/date';
import { getDb } from '../firebase';
import { COLLECTIONS, GLOBAL_LEADERBOARD_ID, type LeaderboardEntryDoc } from './schema';

/**
 * Leaderboards.
 *
 * Three boards share one collection shape, keyed by period id:
 *   - `global`      all-time XP
 *   - `2026-W31`    XP earned that ISO week
 *   - `2026-08-01`  best score on that day's Daily Challenge
 *
 * Entries are denormalised (they carry the display name and avatar) so a board
 * of 100 players costs 100 document reads rather than 200. All writes happen in
 * Cloud Functions; clients have read-only access.
 */

export type LeaderboardPeriod = 'global' | 'weekly' | 'daily';

export interface LeaderboardRow extends LeaderboardEntryDoc {
  rank: number;
  isCurrentUser: boolean;
}

export function periodId(period: LeaderboardPeriod, now: number = Date.now()): string {
  switch (period) {
    case 'global':
      return GLOBAL_LEADERBOARD_ID;
    case 'weekly':
      return toWeekKey(now);
    case 'daily':
      return toDateKey(now);
  }
}

export async function fetchLeaderboard(input: {
  period: LeaderboardPeriod;
  currentUid?: string | null;
  count?: number;
  now?: number;
}): Promise<LeaderboardRow[]> {
  const id = periodId(input.period, input.now ?? Date.now());
  const entries = collection(getDb(), COLLECTIONS.leaderboards, id, COLLECTIONS.entries);

  const snapshot = await getDocs(
    query(entries, orderBy('score', 'desc'), fbLimit(input.count ?? 50)),
  );

  return snapshot.docs.map((docSnap, index) => {
    const data = docSnap.data() as LeaderboardEntryDoc;
    return {
      ...data,
      rank: index + 1,
      isCurrentUser: !!input.currentUid && data.uid === input.currentUid,
    };
  });
}

/**
 * The current user's own entry, fetched directly by id so we can pin it to the
 * bottom of the board even when they are outside the visible top N.
 */
export async function fetchMyEntry(
  period: LeaderboardPeriod,
  uid: string,
  now: number = Date.now(),
): Promise<LeaderboardEntryDoc | null> {
  const id = periodId(period, now);
  const snapshot = await getDoc(
    doc(getDb(), COLLECTIONS.leaderboards, id, COLLECTIONS.entries, uid),
  );
  return snapshot.exists() ? (snapshot.data() as LeaderboardEntryDoc) : null;
}

export const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  daily: 'Today',
  weekly: 'This week',
  global: 'All time',
};

export const PERIOD_METRIC_LABELS: Record<LeaderboardPeriod, string> = {
  daily: 'score',
  weekly: 'XP',
  global: 'XP',
};
