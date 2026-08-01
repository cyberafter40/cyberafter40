import { useCallback, useEffect, useState } from 'react';
import { deriveDailyChallenge } from '@/daily/challenge';
import { fetchDailyChallenge, fetchDailyEntry, type DailyChallengeView } from '@/services/firestore/daily';
import type { DailyEntryDoc } from '@/services/firestore/schema';
import { msUntilNextUtcDay, toDateKey } from '@/utils/date';

export interface DailyChallengeState {
  challenge: DailyChallengeView;
  /** The player's attempt, if they have already played today. */
  entry: DailyEntryDoc | null;
  loading: boolean;
  /** Milliseconds until the next challenge unlocks — ticks once a second. */
  msRemaining: number;
  refresh: () => Promise<void>;
}

/**
 * Today's challenge and whether the player has used their single attempt.
 *
 * The challenge is derived locally first so the home screen renders instantly
 * and works offline; the network fetch only enriches it with community stats.
 */
export function useDailyChallenge(uid: string | null): DailyChallengeState {
  const dateKey = toDateKey();

  const [challenge, setChallenge] = useState<DailyChallengeView>(() => ({
    ...deriveDailyChallenge(dateKey),
    stats: null,
  }));
  const [entry, setEntry] = useState<DailyEntryDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [msRemaining, setMsRemaining] = useState(() => msUntilNextUtcDay());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [remote, played] = await Promise.all([
        fetchDailyChallenge(dateKey),
        uid ? fetchDailyEntry(uid, dateKey).catch(() => null) : Promise.resolve(null),
      ]);
      setChallenge(remote);
      setEntry(played);
    } finally {
      setLoading(false);
    }
  }, [dateKey, uid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => setMsRemaining(msUntilNextUtcDay()), 1000);
    return () => clearInterval(timer);
  }, []);

  return { challenge, entry, loading, msRemaining, refresh };
}
