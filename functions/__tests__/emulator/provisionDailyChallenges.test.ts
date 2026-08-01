/**
 * `provisionDailyChallenges` against the Firestore emulator.
 *
 * The job has one dangerous failure mode: rewriting a challenge document that
 * players are already mid-way through would change the puzzle underneath them
 * and invalidate every result submitted that day. It is written to be
 * create-only for exactly that reason, and this suite is what holds it to that.
 */

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT ?? 'mindcode-rules-test';

import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { deriveDailyChallenge } from '@/daily/challenge';
import { registerAllGameModules } from '@/games';
import { addDays, toDateKey } from '@/utils/date';
import { provisionDailyChallenges } from '../../src/daily';

registerAllGameModules();

const NOW = Date.now();
const TODAY = toDateKey(NOW);
const HORIZON = [0, 1, 2].map((offset) => addDays(TODAY, offset));

const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore();

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await Promise.all(HORIZON.map((key) => db.doc(`challenges/${key}`).delete()));
});

afterAll(async () => {
  await Promise.all(HORIZON.map((key) => db.doc(`challenges/${key}`).delete()));
});

/** Runs the scheduled handler the way Cloud Scheduler does. */
function run() {
  return (provisionDailyChallenges as unknown as { run: (e: unknown) => Promise<void> }).run({
    scheduleTime: new Date(NOW).toISOString(),
    jobName: 'provisionDailyChallenges',
  });
}

describe('provisionDailyChallenges', () => {
  it('creates today plus two days ahead, so one failed run cannot leave a gap', async () => {
    await run();

    for (const key of HORIZON) {
      const snapshot = await db.doc(`challenges/${key}`).get();
      expect(snapshot.exists).toBe(true);
      expect(snapshot.data()?.date).toBe(key);
    }
  });

  it('writes exactly the challenge every client derives locally', async () => {
    await run();

    for (const key of HORIZON) {
      const derived = deriveDailyChallenge(key);
      const stored = (await db.doc(`challenges/${key}`).get()).data();

      expect(stored?.seed).toBe(derived.seed);
      expect(stored?.variantId).toBe(derived.variantId);
      expect(stored?.moduleId).toBe(derived.moduleId);
    }
  });

  it('starts the community counters at zero', async () => {
    await run();
    const stats = (await db.doc(`challenges/${TODAY}`).get()).data()?.stats;

    expect(stats).toEqual({ played: 0, solved: 0, totalMoves: 0, totalScore: 0 });
  });

  it('never rewrites a challenge players are already mid-way through', async () => {
    await run();
    // Simulate a day's play accumulating on today's document.
    await db.doc(`challenges/${TODAY}`).update({
      'stats.played': 4_812,
      'stats.solved': 3_140,
    });

    await run();

    const stats = (await db.doc(`challenges/${TODAY}`).get()).data()?.stats;
    expect(stats.played).toBe(4_812);
    expect(stats.solved).toBe(3_140);
  });

  it('is idempotent — a retried run changes nothing', async () => {
    await run();
    const before = await Promise.all(
      HORIZON.map(async (key) => (await db.doc(`challenges/${key}`).get()).data()),
    );

    await run();
    await run();

    const after = await Promise.all(
      HORIZON.map(async (key) => (await db.doc(`challenges/${key}`).get()).data()),
    );

    expect(after).toEqual(before);
  });

  it('fills a gap left by a missed run without disturbing the others', async () => {
    await run();
    const untouched = (await db.doc(`challenges/${TODAY}`).get()).data();

    // Tomorrow goes missing — a partial failure, or a manual deletion.
    const tomorrow = HORIZON[1] as string;
    await db.doc(`challenges/${tomorrow}`).delete();

    await run();

    expect((await db.doc(`challenges/${tomorrow}`).get()).exists).toBe(true);
    expect((await db.doc(`challenges/${TODAY}`).get()).data()).toEqual(untouched);
  });
});
