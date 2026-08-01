import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  deleteAccount as authDeleteAccount,
  ensureSignedIn,
  observeAuth,
  registerWithEmail,
  requestPasswordReset,
  signInWithEmail,
  signOut as authSignOut,
  type AuthUser,
} from '@/services/auth';
import { identify, track } from '@/services/analytics';
import { clearAllLocalData } from '@/services/storage';

interface AuthContextValue {
  user: AuthUser | null;
  /** True until the first auth state resolution completes. */
  initialising: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth state.
 *
 * On first launch this silently creates an anonymous session so the player can
 * start the Daily Challenge without a sign-up wall. Registering later links the
 * credential to the same uid, preserving every stat.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initialising, setInitialising] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = observeAuth((next) => {
      if (cancelled) return;
      setUser(next);
      identify(next?.uid ?? null);
      setInitialising(false);

      if (!next) {
        // Signed out (or first ever launch) — get an anonymous session going.
        void ensureSignedIn().catch(() => setInitialising(false));
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const wasAnonymous = user?.isAnonymous ?? false;
      const next = await registerWithEmail(email, password, displayName);
      setUser(next);
      track('sign_up', { method: 'email' });
      if (wasAnonymous) track('account_linked', {});
    },
    [user],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await signInWithEmail(email, password);
    setUser(next);
    track('login', { method: 'email' });
  }, []);

  const signOut = useCallback(async () => {
    await clearAllLocalData();
    await authSignOut();
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    await authDeleteAccount();
    await clearAllLocalData();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initialising,
      signUp,
      signIn,
      resetPassword: requestPasswordReset,
      signOut,
      deleteAccount,
    }),
    [user, initialising, signUp, signIn, signOut, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
