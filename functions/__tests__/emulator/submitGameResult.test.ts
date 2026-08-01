/**
 * `submitGameResult` against the Firestore emulator.
 *
 * `replay.test.ts` proves a forged *game* cannot be scored. This proves the
 * write side: that a legitimate game produces exactly the six documents the
 * schema promises, that the client's claimed score never reaches the database,
 * and — the one that carries a product rule rather than a security rule — that
 * the Daily Challenge really is one attempt, because the transaction refuses a
 * session id it has already seen.
 */

// Must be set before firebase-admin initialises, or it will try to reach the
// real project.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT ?? 'mindcode-rules-test';

import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GameSession, type GameResult } from '@/engine/session';
import { deriveDailyChallenge, dailySessionId } from '@/daily/challenge';
import { registerAllGameModules } from '@/games';
import type { NumberLogicState } from '@/games/numberLogic/engine';
import type { UserProfile } from '@/progress/types';
import { toDateKey, toWeekKey } from '@/utils/date';
import { submitGameResult } from '../../src/submit';

registerAllGameModules();

const UID = 'player-1';

// `submitGameResult` validates timestamps against the real clock, so the suite
// has to play in real time rather than at a pinned instant — a fixed date would
// pass today and start failing tomorrow.
const NOW = Date.now();
const CHALLENGE_ID = toDateKey(NOW);

const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore();

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await wipe();
});

/** Removes everything this suite touches; the emulator has no per-test reset. */
async function wipe(): Promise<void> {
  const profile = db.doc(`profiles/${UID}`);
  for (const name of ['sessions', 'dailyEntries']) {
    const docs = await profile.collection(name).get();
    await Promise.all(docs.docs.map((d) => d.ref.delete()));
  }
  await profile.delete();
  await db.doc(`publicProfiles/${UID}`).delete();
  for (const period of ['global', toWeekKey(NOW), CHALLENGE_ID]) {
    await db.doc(`leaderboards/${period}/entries/${UID}`).delete();
  }
  await db.doc(`challenges/${CHALLENGE_ID}`).delete();
}

/** Plays a real Daily Challenge and returns the result the app would submit. */
function playDaily(options: { uid?: string; wrongGuesses?: string[] } = {}): GameResult {
  const uid = options.uid ?? UID;
  const daily = deriveDailyChallenge(CHALLENGE_ID);

  let clock = NOW - 120_000;
  const session = new GameSession({
    sessionId: dailySessionId(uid, CHALLENGE_ID),
    moduleId: daily.moduleId,
    variantId: daily.variantId,
    mode: 'daily',
    seed: daily.seed,
    challengeId: CHALLENGE_ID,
    now: () => {
      const at = clock;
      clock += 9_000;
      return at;
    },
  });

  const secret = session.getState<NumberLogicState>().secret;
  for (const guess of options.wrongGuesses ?? []) {
    if (guess !== secret) session.submit({ guess });
  }
  session.submit({ guess: secret });

  return session.toResult();
}

/** Invokes the callable the way the Functions runtime does. */
function call(result: unknown, auth: { uid: string } | null = { uid: UID }) {
  const request = {
    data: { result },
    auth: auth
      ? { uid: auth.uid, token: { name: 'Quiet Falcon', firebase: { sign_in_provider: 'password' } } }
      : undefined,
    rawRequest: {} as never,
    acceptsStreaming: false,
  };
  return (submitGameResult as unknown as { run: (r: unknown) => Promise<never> }).run(request);
}

describe('submitGameResult — a legitimate daily win', () => {
  it('writes the profile, session, daily entry, public profile and three boards', async () => {
    const result = playDaily({ wrongGuesses: ['12', '34'] });
    const response = (await call(result)) as unknown as { status: string; score: number; xp: number };

    expect(response.status).toBe('recorded');
    expect(response.score).toBeGreaterThan(0);

    const profile = (await db.doc(`profiles/${UID}`).get()).data() as UserProfile;
    expect(profile.xp).toBe(response.xp);
    expect(profile.stats.played).toBe(1);
    expect(profile.stats.won).toBe(1);
    expect(profile.stats.dailyCompleted).toBe(1);
    expect(profile.streak.current).toBe(1);
    expect(Object.keys(profile.badges).length).toBeGreaterThan(0);

    const session = await db.doc(`profiles/${UID}/sessions/${result.sessionId}`).get();
    expect(session.exists).toBe(true);
    expect(session.data()?.solution).toBe(result.solution);
    expect(session.data()?.status).toBe('won');

    const entry = await db.doc(`profiles/${UID}/dailyEntries/${CHALLENGE_ID}`).get();
    expect(entry.exists).toBe(true);
    expect(entry.data()?.score).toBe(response.score);

    const publicProfile = await db.doc(`publicProfiles/${UID}`).get();
    expect(publicProfile.data()?.displayName).toBe(profile.displayName);
    expect(publicProfile.data()?.title).toBeTruthy();

    const [global, weekly, daily] = await Promise.all([
      db.doc(`leaderboards/global/entries/${UID}`).get(),
      db.doc(`leaderboards/${toWeekKey(result.finishedAt)}/entries/${UID}`).get(),
      db.doc(`leaderboards/${CHALLENGE_ID}/entries/${UID}`).get(),
    ]);
    expect(global.data()?.score).toBe(profile.xp);
    expect(weekly.data()?.score).toBe(response.xp);
    expect(daily.data()?.score).toBe(response.score);
    expect(daily.data()?.movesUsed).toBe(result.outcome.movesUsed);
  });

  it('accumulates challenge statistics for social proof', async () => {
    await call(playDaily());
    const challenge = await db.doc(`challenges/${CHALLENGE_ID}`).get();

    expect(challenge.data()?.stats.played).toBe(1);
    expect(challenge.data()?.stats.solved).toBe(1);
  });
});

describe('submitGameResult — one attempt per day', () => {
  it('ignores a replay of the same session instead of double-counting it', async () => {
    const result = playDaily();

    const first = (await call(result)) as unknown as { status: string; xp: number };
    const second = (await call(result)) as unknown as { status: string };

    expect(first.status).toBe('recorded');
    expect(second.status).toBe('duplicate');

    const profile = (await db.doc(`profiles/${UID}`).get()).data() as UserProfile;
    expect(profile.stats.played).toBe(1);
    expect(profile.xp).toBe(first.xp);
  });

  it('refuses a second daily attempt, because its session id is deterministic', async () => {
    await call(playDaily());

    // A player re-opening the challenge produces the same id by construction.
    const retry = playDaily({ wrongGuesses: ['12'] });
    expect(retry.sessionId).toBe(dailySessionId(UID, CHALLENGE_ID));
    expect(((await call(retry)) as unknown as { status: string }).status).toBe('duplicate');

    const entries = await db.collection(`profiles/${UID}/dailyEntries`).get();
    expect(entries.size).toBe(1);
  });

  it('does not inflate the weekly board on a duplicate', async () => {
    const result = playDaily();
    await call(result);
    const afterFirst = (await db.doc(`leaderboards/${toWeekKey(NOW)}/entries/${UID}`).get()).data();

    await call(result);
    const afterSecond = (await db.doc(`leaderboards/${toWeekKey(NOW)}/entries/${UID}`).get()).data();

    expect(afterSecond?.score).toBe(afterFirst?.score);
  });
});

describe('submitGameResult — trust boundary', () => {
  it('rejects an unauthenticated call', async () => {
    await expect(call(playDaily(), null)).rejects.toThrow(/Sign in/);
  });

  it('rejects a forged seed before writing anything', async () => {
    const result = playDaily();
    const forged: GameResult = { ...result, seed: deriveDailyChallenge('2020-01-01').seed };

    await expect(call(forged)).rejects.toThrow(/does not match that date/);
    expect((await db.doc(`profiles/${UID}`).get()).exists).toBe(false);
  });

  it('scores from the replay, not from anything the client sent', async () => {
    const honest = playDaily({ wrongGuesses: ['12', '34', '56'] });
    const inflated: GameResult = {
      ...honest,
      outcome: { ...honest.outcome, movesUsed: 1, accuracy: 1, durationMs: 1 },
    };

    const response = (await call(inflated)) as unknown as { score: number };

    const session = await db.doc(`profiles/${UID}/sessions/${honest.sessionId}`).get();
    expect(session.data()?.movesUsed).toBe(honest.outcome.movesUsed);
    expect(session.data()?.durationMs).toBe(honest.outcome.durationMs);
    expect(session.data()?.score).toBe(response.score);
  });

  it('writes a loss without awarding a win', async () => {
    const daily = deriveDailyChallenge(CHALLENGE_ID);
    let clock = NOW - 200_000;
    const session = new GameSession({
      sessionId: dailySessionId(UID, CHALLENGE_ID),
      moduleId: daily.moduleId,
      variantId: daily.variantId,
      mode: 'daily',
      seed: daily.seed,
      challengeId: CHALLENGE_ID,
      now: () => {
        const at = clock;
        clock += 9_000;
        return at;
      },
    });

    const state = session.getState<NumberLogicState>();
    let attempts = 0;
    for (let a = 0; a < 10 && !session.isOver; a += 1) {
      for (let b = 0; b < 10 && !session.isOver; b += 1) {
        if (a === b) continue;
        const guess = `${a}${b}`.slice(0, state.config.digits).padEnd(state.config.digits, '7');
        if (guess === state.secret) continue;
        if (session.submit({ guess }).accepted) attempts += 1;
      }
    }

    expect(attempts).toBeGreaterThan(0);
    await call(session.toResult());

    const profile = (await db.doc(`profiles/${UID}`).get()).data() as UserProfile;
    expect(profile.stats.played).toBe(1);
    expect(profile.stats.won).toBe(0);
    expect(profile.stats.dailyCompleted).toBe(0);
    // Showing up still counts toward the streak.
    expect(profile.streak.current).toBe(1);
  });
});

describe('submitGameResult — repeat players', () => {
  it('folds a second game into the existing profile rather than resetting it', async () => {
    await call(playDaily());
    const afterFirst = (await db.doc(`profiles/${UID}`).get()).data() as UserProfile;

    // A classic game on the same day: different session id, so not a duplicate.
    let clock = NOW - 60_000;
    const classic = new GameSession({
      sessionId: `${UID}_classic_1`,
      moduleId: 'number-logic',
      variantId: 'two-digit',
      mode: 'classic',
      seed: 'classic:player-1:two-digit:99',
      now: () => {
        const at = clock;
        clock += 9_000;
        return at;
      },
    });
    classic.submit({ guess: classic.getState<NumberLogicState>().secret });
    await call(classic.toResult());

    const afterSecond = (await db.doc(`profiles/${UID}`).get()).data() as UserProfile;
    expect(afterSecond.stats.played).toBe(2);
    expect(afterSecond.xp).toBeGreaterThan(afterFirst.xp);
    // Two games on one day is still a one-day streak.
    expect(afterSecond.streak.current).toBe(1);
    expect(afterSecond.stats.dailyCompleted).toBe(1);
  });
});
