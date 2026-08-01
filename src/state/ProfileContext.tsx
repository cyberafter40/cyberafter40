import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { UserProfile, UserSettings } from '@/progress/types';
import { effectiveStreak } from '@/progress/streak';
import { setPlayerProperties } from '@/services/analytics';
import {
  ensureProfile,
  observeProfile,
  updateIdentity,
  updateSettings as persistSettings,
} from '@/services/firestore/profiles';
import { cacheProfile, readCachedProfile } from '@/services/storage';
import { flushPendingResults } from '@/services/submission';
import { setHapticsEnabled } from '@/ui/haptics';
import { generateDisplayName } from '@/utils/names';
import { useAuth } from './AuthContext';

interface ProfileContextValue {
  profile: UserProfile | null;
  loading: boolean;
  /** Non-fatal sync problem — the app keeps working from cache. */
  syncError: string | null;
  /** Streak adjusted for a lapsed day, which is what the UI should show. */
  streak: number;
  /** Optimistically replace the profile after a finished game. */
  applyLocalProfile: (profile: UserProfile) => void;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  updateProfileIdentity: (identity: {
    displayName?: string;
    avatarId?: number;
  }) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

/**
 * Profile state.
 *
 * Reads are three-layered so the home screen never shows a spinner on a warm
 * start: cached profile → server snapshot → optimistic local updates after a
 * game. The Firestore listener is authoritative and quietly corrects anything
 * the optimistic path got wrong.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Paint from cache immediately, before any network call resolves.
  useEffect(() => {
    let cancelled = false;
    void readCachedProfile().then((cached) => {
      if (!cancelled && cached) setProfile((current) => current ?? cached);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const start = async () => {
      try {
        const initial = await ensureProfile({
          uid: user.uid,
          displayName: user.displayName ?? generateDisplayName(user.uid),
          isAnonymous: user.isAnonymous,
        });
        if (cancelled) return;

        setProfile(initial);
        void cacheProfile(initial);
        setSyncError(null);

        unsubscribe = observeProfile(
          user.uid,
          (next) => {
            if (!next || cancelled) return;
            setProfile(next);
            void cacheProfile(next);
          },
          (error) => setSyncError(error.message),
        );

        // A finished game may be waiting from an offline session.
        void flushPendingResults();
      } catch (error) {
        if (!cancelled) {
          setSyncError((error as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void start();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user]);

  // Keep cross-cutting concerns in sync with the profile.
  useEffect(() => {
    if (!profile) return;
    setHapticsEnabled(profile.settings.haptics);
    setPlayerProperties({
      level: profile.level,
      streak: profile.streak.current,
      isAnonymous: profile.isAnonymous,
    });
  }, [profile]);

  const applyLocalProfile = useCallback((next: UserProfile) => {
    setProfile(next);
    void cacheProfile(next);
  }, []);

  const updateSettings = useCallback(
    async (settings: Partial<UserSettings>) => {
      if (!profile) return;
      const next: UserProfile = {
        ...profile,
        settings: { ...profile.settings, ...settings },
        updatedAt: Date.now(),
      };
      applyLocalProfile(next);
      try {
        await persistSettings(profile.uid, settings);
      } catch (error) {
        setSyncError((error as Error).message);
      }
    },
    [profile, applyLocalProfile],
  );

  const updateProfileIdentity = useCallback(
    async (identity: { displayName?: string; avatarId?: number }) => {
      if (!profile) return;
      applyLocalProfile({ ...profile, ...identity, updatedAt: Date.now() });
      try {
        await updateIdentity(profile.uid, identity);
      } catch (error) {
        setSyncError((error as Error).message);
      }
    },
    [profile, applyLocalProfile],
  );

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      loading,
      syncError,
      streak: profile ? effectiveStreak(profile.streak) : 0,
      applyLocalProfile,
      updateSettings,
      updateProfileIdentity,
    }),
    [profile, loading, syncError, applyLocalProfile, updateSettings, updateProfileIdentity],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used inside <ProfileProvider>');
  return context;
}
