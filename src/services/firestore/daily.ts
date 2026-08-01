import { doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { deriveDailyChallenge, type DailyChallenge } from '@/daily/challenge';
import { tryGetGameModule } from '@/engine/registry';
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
      return mergeWithDerived(derived, snapshot.data() as Partial<DailyChallengeDoc>);
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
    const derived = deriveDailyChallenge(dateKey);
    if (!snapshot.exists()) {
      onChange({ ...derived, stats: null });
      return;
    }
    onChange(mergeWithDerived(derived, snapshot.data() as Partial<DailyChallengeDoc>));
  });
}

/**
 * Combines the locally derived challenge with whatever the server document
 * happens to carry.
 *
 * The remote document is an *enrichment*, never a source of required fields. It
 * can legitimately be partial — the stats counters are merged in by
 * `submitGameResult`, which may reach the document before the scheduled
 * provisioner does — and a client that read `moduleId` straight off it would
 * hand `undefined` to the registry and crash the home screen for everyone. It
 * did, once; that is why this function exists.
 *
 * A module id the server names but this build does not have is treated the same
 * way, so an older app keeps working after a new module ships server-side.
 */
function mergeWithDerived(
  derived: DailyChallenge,
  remote: Partial<DailyChallengeDoc>,
): DailyChallengeView {
  const moduleId =
    remote.moduleId && tryGetGameModule(remote.moduleId) ? remote.moduleId : derived.moduleId;

  // Variant and seed only travel with a module this build understands.
  const usingRemoteModule = moduleId === remote.moduleId;

  return {
    id: remote.id ?? derived.id,
    date: remote.date ?? derived.date,
    moduleId,
    variantId: (usingRemoteModule ? remote.variantId : undefined) ?? derived.variantId,
    seed: (usingRemoteModule ? remote.seed : undefined) ?? derived.seed,
    stats: remote.stats ?? null,
  };
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
