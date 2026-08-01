import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { createProfile, PROFILE_SCHEMA_VERSION, type UserProfile, type UserSettings } from '@/progress/types';
import { getDb } from '../firebase';
import { paths } from './schema';

/**
 * Profile repository.
 *
 * The profile document is the player's whole progression state. It is written
 * authoritatively by the `submitGameResult` Cloud Function; the client only
 * writes presentation fields it fully owns (display name, avatar, settings).
 */

function profileRef(uid: string) {
  const [collectionId, docId] = paths.profile(uid).split('/');
  return doc(getDb(), collectionId as string, docId as string);
}

export async function fetchProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(profileRef(uid));
  return snapshot.exists() ? migrate(snapshot.data() as UserProfile) : null;
}

/**
 * Creates the profile on first launch. Uses `merge: false` guarded by an
 * existence check rather than a blind write so a returning user's progress can
 * never be clobbered by a race between two devices.
 */
export async function ensureProfile(input: {
  uid: string;
  displayName: string;
  isAnonymous: boolean;
  countryCode?: string | null;
}): Promise<UserProfile> {
  const existing = await fetchProfile(input.uid);
  if (existing) return existing;

  const profile = createProfile({ ...input, now: Date.now() });
  await setDoc(profileRef(input.uid), profile);
  return profile;
}

export function observeProfile(
  uid: string,
  onChange: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    profileRef(uid),
    (snapshot) => onChange(snapshot.exists() ? migrate(snapshot.data() as UserProfile) : null),
    (error) => onError?.(error),
  );
}

export async function updateSettings(uid: string, settings: Partial<UserSettings>): Promise<void> {
  // `merge: true` deep-merges maps, so a partial settings object updates only
  // the keys it names and leaves the rest intact. That is the same semantics
  // dotted field paths gave us, without the untypeable dynamic-key patch.
  await setDoc(
    profileRef(uid),
    { settings, updatedAt: Date.now() },
    { merge: true },
  );
}

export async function updateIdentity(
  uid: string,
  identity: { displayName?: string; avatarId?: number; countryCode?: string | null },
): Promise<void> {
  await updateDoc(profileRef(uid), { ...identity, updatedAt: Date.now() });
}

/**
 * Forward-migrates documents written by older app versions. Runs on every read,
 * so a returning user on a stale schema never sees a broken screen.
 */
function migrate(profile: UserProfile): UserProfile {
  if (profile.schemaVersion === PROFILE_SCHEMA_VERSION) return profile;

  // v0 (pre-release) documents lacked the per-module breakdown.
  return {
    ...profile,
    modules: profile.modules ?? {},
    badges: profile.badges ?? {},
    schemaVersion: PROFILE_SCHEMA_VERSION,
  };
}
