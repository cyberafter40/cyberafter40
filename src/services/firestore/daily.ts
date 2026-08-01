import { doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { deriveDailyChallenge, type DailyChallenge } from '@/daily/challenge';
import { toDateKey } from '@/utils/date';
import { getDb } from '../firebase';
import { paths, type DailyChallengeDoc, type DailyEntryDoc } from './schema';

/**
 * Daily Challenge repository.
 *
 * The challenge document exists mainly to carry community stats and to give the
 * backend an anchor for leaderboards. The puzzle itself is derived locally, so
 * a player with no connection still gets today's challenge — the document is an
 * enrichment, never a dependency.
 */

function challengeRef(dateKey: string) {
  const [collectionId, docId] = paths.challenge(dateKey).split('/');
  return doc(getDb(), collectionId as string, docId as string);
}

function dailyEntryRef(uid: string, challengeId: string) {
  const [profiles, uidSeg, entries, entryId] = paths.dailyEntry(uid, challengeId).split('/');
  return doc(getDb(), profiles as string, uidSeg as string, entries as string, entryId as string);
}

export interface DailyChallengeView extends DailyChallenge {
  stats: DailyChallengeDoc['stats'] | null;
}

export async function fetchDailyChallenge(
  dateKey: string = toDateKey(),
): Promise<DailyChallengeView> {
  const derived = deriveDailyChallenge(dateKey);

  try {
    const snapshot = await getDoc(challengeRef(dateKey));
    if (snapshot.exists()) {
      const remote = snapshot.data() as DailyChallengeDoc;
      // Trust the server's variant if it ever diverges from local derivation
      // (e.g. a mid-day hotfix), but keep playing regardless.
      return {
        id: remote.id,
        date: remote.date,
        moduleId: remote.moduleId,
        variantId: remote.variantId,
        seed: remote.seed,
        stats: remote.stats ?? null,
      };
    }
  } catch {
    // Offline or rules denied — the derived challenge is authoritative enough.
  }

  return { ...derived, stats: null };
}

export function observeDailyChallenge(
  dateKey: string,
  onChange: (challenge: DailyChallengeView) => void,
): Unsubscribe {
  return onSnapshot(challengeRef(dateKey), (snapshot) => {
    if (!snapshot.exists()) {
      onChange({ ...deriveDailyChallenge(dateKey), stats: null });
      return;
    }
    const remote = snapshot.data() as DailyChallengeDoc;
    onChange({
      id: remote.id,
      date: remote.date,
      moduleId: remote.moduleId,
      variantId: remote.variantId,
      seed: remote.seed,
      stats: remote.stats ?? null,
    });
  });
}

/** The player's single attempt at a given day, if they have played it. */
export async function fetchDailyEntry(
  uid: string,
  challengeId: string,
): Promise<DailyEntryDoc | null> {
  const snapshot = await getDoc(dailyEntryRef(uid, challengeId));
  return snapshot.exists() ? (snapshot.data() as DailyEntryDoc) : null;
}

export function observeDailyEntry(
  uid: string,
  challengeId: string,
  onChange: (entry: DailyEntryDoc | null) => void,
): Unsubscribe {
  return onSnapshot(dailyEntryRef(uid, challengeId), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.data() as DailyEntryDoc) : null);
  });
}
