import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import type { TranslationKey } from '@/i18n/types';
import { getFirebaseAuth, getFirebaseFunctions } from './firebase';

/**
 * Authentication.
 *
 * MindCode is play-first: a new user is signed in anonymously on launch and can
 * complete their first Daily Challenge before ever seeing a form. Creating a
 * real account *links* credentials to that anonymous user, so streaks, XP and
 * badges survive the upgrade instead of being reset — the single biggest
 * retention trap in habit apps.
 */

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
}

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    isAnonymous: user.isAnonymous,
  };
}

export function observeAuth(callback: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), (user) => {
    callback(user ? toAuthUser(user) : null);
  });
}

export function currentUser(): AuthUser | null {
  const user = getFirebaseAuth().currentUser;
  return user ? toAuthUser(user) : null;
}

export async function ensureSignedIn(): Promise<AuthUser> {
  const auth = getFirebaseAuth();
  if (auth.currentUser) return toAuthUser(auth.currentUser);
  const credential = await signInAnonymously(auth);
  return toAuthUser(credential.user);
}

/**
 * Creates a permanent account. When the player is already playing anonymously
 * the credential is linked to the existing uid, preserving all progress.
 */
export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthUser> {
  const auth = getFirebaseAuth();
  const existing = auth.currentUser;

  if (existing?.isAnonymous) {
    const credential = EmailAuthProvider.credential(email, password);
    const linked = await linkWithCredential(existing, credential);
    await updateProfile(linked.user, { displayName });
    return toAuthUser(linked.user);
  }

  const created = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(created.user, { displayName });
  return toAuthUser(created.user);
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  return toAuthUser(credential.user);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

export async function signOut(): Promise<void> {
  await fbSignOut(getFirebaseAuth());
}

export async function updateDisplayName(displayName: string): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('Not signed in');
  await updateProfile(user, { displayName });
}

/**
 * Permanently deletes the account and every document belonging to it.
 *
 * App Store Review Guideline 5.1.1(v) requires in-app account deletion for any
 * app that supports account creation, so this is a shipping requirement, not a
 * nice-to-have. The heavy lifting happens in the `deleteAccount` Cloud Function
 * because a client cannot remove its own leaderboard and session documents
 * under our security rules.
 */
export async function deleteAccount(): Promise<void> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  const purge = httpsCallable(getFirebaseFunctions(), 'deleteAccount');
  await purge();
  await fbSignOut(auth);
}

/** Human-readable messages for the Firebase auth error codes we surface. */
/**
 * Maps a Firebase auth error code to a translation key.
 *
 * A key rather than a sentence: this is a service, and services do not know
 * which language the player reads. The screen translates it.
 */
export function describeAuthError(error: unknown): TranslationKey {
  const code = (error as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'authError.invalidEmail';
    case 'auth/email-already-in-use':
      return 'authError.emailInUse';
    case 'auth/weak-password':
      return 'authError.weakPassword';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'authError.wrongCredentials';
    case 'auth/too-many-requests':
      return 'authError.tooManyRequests';
    case 'auth/network-request-failed':
      return 'authError.networkFailed';
    case 'auth/requires-recent-login':
      return 'authError.recentLogin';
    default:
      return 'authError.generic';
  }
}
