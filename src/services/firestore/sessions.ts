import {
  collection,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import { COLLECTIONS, type DailyEntryDoc, type SessionDoc } from './schema';

/**
 * Session history repository (read-only from the client).
 *
 * Session documents are written by the `submitGameResult` Cloud Function. The
 * app reads them for the "recent games" list and the per-variant history; all
 * headline statistics come from the pre-aggregated profile instead, so opening
 * the stats screen costs a single document read.
 */

function sessionsCollection(uid: string) {
  return collection(getDb(), COLLECTIONS.profiles, uid, COLLECTIONS.sessions);
}

function dailyEntriesCollection(uid: string) {
  return collection(getDb(), COLLECTIONS.profiles, uid, COLLECTIONS.dailyEntries);
}

export async function listRecentSessions(uid: string, count = 20): Promise<SessionDoc[]> {
  const snapshot = await getDocs(
    query(sessionsCollection(uid), orderBy('finishedAt', 'desc'), fbLimit(count)),
  );
  return snapshot.docs.map((d) => d.data() as SessionDoc);
}

export async function listSessionsForVariant(
  uid: string,
  moduleId: string,
  variantId: string,
  count = 20,
): Promise<SessionDoc[]> {
  const snapshot = await getDocs(
    query(
      sessionsCollection(uid),
      where('moduleId', '==', moduleId),
      where('variantId', '==', variantId),
      orderBy('finishedAt', 'desc'),
      fbLimit(count),
    ),
  );
  return snapshot.docs.map((d) => d.data() as SessionDoc);
}

/** Daily attempt history — one entry per calendar day, newest first. */
export async function listDailyEntries(uid: string, count = 30): Promise<DailyEntryDoc[]> {
  const snapshot = await getDocs(
    query(dailyEntriesCollection(uid), orderBy('finishedAt', 'desc'), fbLimit(count)),
  );
  return snapshot.docs.map((d) => d.data() as DailyEntryDoc);
}
