import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

/**
 * `deleteAccount` — irreversible removal of a player and everything about them.
 *
 * Required by App Store Review Guideline 5.1.1(v) for any app offering account
 * creation, and by GDPR/CCPA erasure requests. A client cannot do this itself:
 * security rules deny writes to its own session log and leaderboard entries
 * precisely so that scores cannot be forged, which means deletion has to happen
 * with admin credentials.
 *
 * Order matters — public documents go first, so a partial failure never leaves
 * a name on a leaderboard belonging to an account that no longer exists.
 */
export const deleteAccount = onCall(
  { region: 'us-central1', maxInstances: 10 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to delete your account.');

    const db = getFirestore();

    // 1. Public surfaces.
    await db.doc(`publicProfiles/${uid}`).delete().catch(() => undefined);

    const boards = await db.collectionGroup('entries').where('uid', '==', uid).get();
    await Promise.all(boards.docs.map((doc) => doc.ref.delete().catch(() => undefined)));

    // 2. Private subcollections.
    const profileRef = db.doc(`profiles/${uid}`);
    for (const name of ['sessions', 'dailyEntries']) {
      await deleteCollection(profileRef.collection(name));
    }

    // 3. The profile itself, then the auth record.
    await profileRef.delete().catch(() => undefined);
    await getAuth().deleteUser(uid);

    logger.info('Account deleted', { uid, leaderboardEntries: boards.size });
    return { status: 'deleted' as const };
  },
);

/** Paged delete — a long-running player can accumulate thousands of sessions. */
async function deleteCollection(
  collection: FirebaseFirestore.CollectionReference,
  pageSize = 300,
): Promise<void> {
  for (;;) {
    const page = await collection.limit(pageSize).get();
    if (page.empty) return;

    const batch = collection.firestore.batch();
    page.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    if (page.size < pageSize) return;
  }
}
