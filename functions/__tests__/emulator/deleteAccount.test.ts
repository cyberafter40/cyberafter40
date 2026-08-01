/**
 * `deleteAccount` against the Auth and Firestore emulators.
 *
 * App Store Review Guideline 5.1.1(v) makes in-app account deletion a shipping
 * requirement, and reviewers test it. "Mostly deleted" is a rejection and, for
 * a GDPR erasure request, a compliance problem — so this suite asserts that
 * *nothing* survives, including the leaderboard rows that are the whole reason
 * the client cannot do this itself.
 *
 * KNOWN GAP: the emulator does not enforce index requirements, so a green run
 * here does NOT prove the leaderboard sweep works in production. That sweep is
 * a collection-group query on `entries.uid`, and Firestore's automatic
 * single-field indexes are collection-scoped only — without the explicit
 * COLLECTION_GROUP override in firestore.indexes.json it fails with
 * FAILED_PRECONDITION against a real project. Verify against a deployed
 * staging project before shipping.
 */

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT ?? 'mindcode-rules-test';

import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createProfile } from '@/progress/types';
import { toDateKey, toWeekKey } from '@/utils/date';
import { deleteAccount } from '../../src/account';

const UID = 'delete-me';
const BYSTANDER = 'keep-me';
const NOW = Date.now();
const TODAY = toDateKey(NOW);
const WEEK = toWeekKey(NOW);

// The default app, deliberately: `deleteAccount` resolves its own handles via
// getFirestore()/getAuth() with no arguments, exactly as it does in production.
const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore();
const auth = getAuth();

afterAll(async () => {
  await deleteApp(app);
});

/** Builds a player with history on every surface the app writes to. */
async function seedPlayer(uid: string, options: { sessions?: number } = {}): Promise<void> {
  const sessions = options.sessions ?? 3;

  await auth.createUser({ uid, email: `${uid}@example.com`, password: 'hunter22' });

  await db.doc(`profiles/${uid}`).set(
    createProfile({ uid, displayName: 'Quiet Falcon', isAnonymous: false, now: NOW }),
  );
  await db.doc(`publicProfiles/${uid}`).set({ uid, displayName: 'Quiet Falcon', level: 12 });

  const batch = db.batch();
  for (let i = 0; i < sessions; i += 1) {
    batch.set(db.doc(`profiles/${uid}/sessions/s${i}`), { sessionId: `s${i}`, uid, score: 100 });
  }
  batch.set(db.doc(`profiles/${uid}/dailyEntries/${TODAY}`), { challengeId: TODAY, uid, score: 100 });

  for (const period of ['global', WEEK, TODAY]) {
    batch.set(db.doc(`leaderboards/${period}/entries/${uid}`), {
      uid,
      displayName: 'Quiet Falcon',
      score: 4_000,
      level: 12,
    });
  }
  await batch.commit();
}

async function cleanup(uid: string): Promise<void> {
  for (const name of ['sessions', 'dailyEntries']) {
    const docs = await db.collection(`profiles/${uid}/${name}`).get();
    await Promise.all(docs.docs.map((d) => d.ref.delete()));
  }
  await db.doc(`profiles/${uid}`).delete();
  await db.doc(`publicProfiles/${uid}`).delete();
  for (const period of ['global', WEEK, TODAY]) {
    await db.doc(`leaderboards/${period}/entries/${uid}`).delete();
  }
  await auth.deleteUser(uid).catch(() => undefined);
}

function call(uid: string | null) {
  const request = {
    data: {},
    auth: uid ? { uid, token: { firebase: { sign_in_provider: 'password' } } } : undefined,
    rawRequest: {} as never,
    acceptsStreaming: false,
  };
  return (deleteAccount as unknown as { run: (r: unknown) => Promise<never> }).run(request);
}

beforeEach(async () => {
  await cleanup(UID);
  await cleanup(BYSTANDER);
});

afterAll(async () => {
  await cleanup(UID);
  await cleanup(BYSTANDER);
});

describe('deleteAccount', () => {
  it('removes every document belonging to the player', async () => {
    await seedPlayer(UID);

    const response = (await call(UID)) as unknown as { status: string };
    expect(response.status).toBe('deleted');

    expect((await db.doc(`profiles/${UID}`).get()).exists).toBe(false);
    expect((await db.doc(`publicProfiles/${UID}`).get()).exists).toBe(false);
    expect((await db.collection(`profiles/${UID}/sessions`).get()).size).toBe(0);
    expect((await db.collection(`profiles/${UID}/dailyEntries`).get()).size).toBe(0);

    for (const period of ['global', WEEK, TODAY]) {
      expect((await db.doc(`leaderboards/${period}/entries/${UID}`).get()).exists).toBe(false);
    }
  });

  it('removes the authentication record, so the email can be reused', async () => {
    await seedPlayer(UID);
    await call(UID);

    await expect(auth.getUser(UID)).rejects.toThrow(/no user record/i);
    // The point of removing it: signing up again with the same email must work.
    await expect(
      auth.createUser({ uid: UID, email: `${UID}@example.com`, password: 'hunter22' }),
    ).resolves.toBeTruthy();
  });

  it('leaves other players untouched', async () => {
    await seedPlayer(UID);
    await seedPlayer(BYSTANDER);

    await call(UID);

    expect((await db.doc(`profiles/${BYSTANDER}`).get()).exists).toBe(true);
    expect((await db.doc(`publicProfiles/${BYSTANDER}`).get()).exists).toBe(true);
    expect((await db.collection(`profiles/${BYSTANDER}/sessions`).get()).size).toBe(3);
    expect(
      (await db.doc(`leaderboards/global/entries/${BYSTANDER}`).get()).exists,
    ).toBe(true);
    await expect(auth.getUser(BYSTANDER)).resolves.toBeTruthy();
  });

  it('pages through a long session history rather than truncating it', async () => {
    // deleteCollection() batches at 300; a committed player exceeds that.
    await seedPlayer(UID, { sessions: 0 });

    for (let page = 0; page < 4; page += 1) {
      const batch = db.batch();
      for (let i = 0; i < 200; i += 1) {
        batch.set(db.doc(`profiles/${UID}/sessions/s${page * 200 + i}`), { uid: UID, score: 1 });
      }
      await batch.commit();
    }
    expect((await db.collection(`profiles/${UID}/sessions`).get()).size).toBe(800);

    await call(UID);

    expect((await db.collection(`profiles/${UID}/sessions`).get()).size).toBe(0);
  }, 60_000);

  it('rejects an unauthenticated call', async () => {
    await expect(call(null)).rejects.toThrow(/Sign in/);
  });

  it('is safe to call when there is nothing to delete', async () => {
    // A player who signed up, never played, and immediately deleted.
    await auth.createUser({ uid: UID });

    await expect(call(UID)).resolves.toEqual({ status: 'deleted' });
    await expect(auth.getUser(UID)).rejects.toThrow(/no user record/i);
  });
});
