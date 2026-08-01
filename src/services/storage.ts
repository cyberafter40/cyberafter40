import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameResult } from '@/engine/session';
import type { UserProfile } from '@/progress/types';

/**
 * Local persistence.
 *
 * Two jobs, both about the app feeling instant and never losing a player's
 * work:
 *
 *  - Cache the profile so the home screen renders real numbers on cold start,
 *    before Firestore responds (or when there is no network at all).
 *  - Queue finished games that could not be submitted, and flush them on the
 *    next successful connection. A commuter solving on the subway must not lose
 *    their streak.
 */

const KEYS = {
  profile: 'mindcode.profile.v1',
  pending: 'mindcode.pendingResults.v1',
  onboarded: 'mindcode.onboarded.v1',
  lastSeenDate: 'mindcode.lastSeenDate.v1',
} as const;

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full disk must not crash the game.
  }
}

/* ---------- Cached profile ---------- */

export function cacheProfile(profile: UserProfile): Promise<void> {
  return writeJson(KEYS.profile, profile);
}

export function readCachedProfile(): Promise<UserProfile | null> {
  return readJson<UserProfile>(KEYS.profile);
}

export async function clearCachedProfile(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.profile).catch(() => undefined);
}

/* ---------- Offline submission queue ---------- */

export interface PendingResult {
  result: GameResult;
  queuedAt: number;
  attempts: number;
}

const MAX_PENDING = 50;

export async function readPendingResults(): Promise<PendingResult[]> {
  return (await readJson<PendingResult[]>(KEYS.pending)) ?? [];
}

export async function enqueuePendingResult(result: GameResult): Promise<void> {
  const pending = await readPendingResults();
  // Deterministic session ids make this idempotent: replaying the same daily
  // attempt overwrites rather than duplicates.
  const deduped = pending.filter((p) => p.result.sessionId !== result.sessionId);
  deduped.push({ result, queuedAt: Date.now(), attempts: 0 });
  await writeJson(KEYS.pending, deduped.slice(-MAX_PENDING));
}

export async function replacePendingResults(pending: PendingResult[]): Promise<void> {
  await writeJson(KEYS.pending, pending.slice(-MAX_PENDING));
}

export async function removePendingResult(sessionId: string): Promise<void> {
  const pending = await readPendingResults();
  await writeJson(
    KEYS.pending,
    pending.filter((p) => p.result.sessionId !== sessionId),
  );
}

/* ---------- Misc flags ---------- */

export async function hasOnboarded(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.onboarded)) === '1';
}

export async function markOnboarded(): Promise<void> {
  await AsyncStorage.setItem(KEYS.onboarded, '1').catch(() => undefined);
}

export async function readLastSeenDate(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.lastSeenDate).catch(() => null);
}

export async function writeLastSeenDate(dateKey: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.lastSeenDate, dateKey).catch(() => undefined);
}

export async function clearAllLocalData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS)).catch(() => undefined);
}
