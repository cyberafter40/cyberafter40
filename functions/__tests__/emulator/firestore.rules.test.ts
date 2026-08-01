import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { createProfile, type UserProfile } from '@/progress/types';

/**
 * `firestore.rules` under test.
 *
 * These rules are the only thing standing between a modified client and a
 * fabricated leaderboard, and unlike the replay logic they cannot be unit
 * tested — they only exist inside Firestore. So they run against the real
 * emulator, exercising the exact write shapes the app's repositories produce
 * (`ensureProfile`, `updateSettings`, `updateIdentity`) rather than invented
 * ones, which is what makes a green run mean something.
 */

const PROJECT_ID = 'mindcode-rules-test';
const ALICE = 'alice';
const BOB = 'bob';

let testEnv: RulesTestEnvironment;

function profileFor(uid: string, overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    ...createProfile({ uid, displayName: 'Quiet Falcon', isAnonymous: false, now: 1_000 }),
    ...overrides,
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

/** A signed-in client subject to the rules. */
function db(uid: string) {
  return testEnv.authenticatedContext(uid).firestore();
}

/** A signed-out client. */
function anonDb() {
  return testEnv.unauthenticatedContext().firestore();
}

/** Seeds a document the way the backend would, bypassing rules. */
async function seed(path: string, data: unknown): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const segments = path.split('/');
    await setDoc(doc(context.firestore(), segments[0] as string, ...segments.slice(1)), data as never);
  });
}

describe('profiles/{uid} — creation', () => {
  it('lets a player create their own zeroed profile', async () => {
    await assertSucceeds(setDoc(doc(db(ALICE), 'profiles', ALICE), profileFor(ALICE)));
  });

  it('refuses a profile created for someone else', async () => {
    await assertFails(setDoc(doc(db(BOB), 'profiles', ALICE), profileFor(ALICE)));
  });

  it('refuses a signed-out create', async () => {
    await assertFails(setDoc(doc(anonDb(), 'profiles', ALICE), profileFor(ALICE)));
  });

  it('refuses a profile that starts with XP already banked', async () => {
    await assertFails(
      setDoc(doc(db(ALICE), 'profiles', ALICE), profileFor(ALICE, { xp: 999_999, level: 50 })),
    );
  });

  it('refuses a profile that starts with a streak', async () => {
    await assertFails(
      setDoc(
        doc(db(ALICE), 'profiles', ALICE),
        profileFor(ALICE, {
          streak: { current: 300, longest: 300, lastPlayedDate: '2026-08-01', freezesUsed: 0 },
        }),
      ),
    );
  });

  it('refuses a profile that starts with badges or statistics', async () => {
    await assertFails(
      setDoc(
        doc(db(ALICE), 'profiles', ALICE),
        profileFor(ALICE, { badges: { level_50: { id: 'level_50', unlockedAt: 1 } } }),
      ),
    );

    const stats = profileFor(ALICE);
    await assertFails(
      setDoc(doc(db(ALICE), 'profiles', ALICE), {
        ...stats,
        stats: { ...stats.stats, played: 500, totalScore: 90_000 },
      }),
    );
  });

  it('refuses a profile whose body claims a different uid than its path', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'profiles', ALICE), profileFor(BOB)));
  });

  it('refuses a display name that is too short or too long', async () => {
    await assertFails(
      setDoc(doc(db(ALICE), 'profiles', ALICE), profileFor(ALICE, { displayName: 'x' })),
    );
    await assertFails(
      setDoc(doc(db(ALICE), 'profiles', ALICE), profileFor(ALICE, { displayName: 'x'.repeat(21) })),
    );
  });
});

describe('profiles/{uid} — reads', () => {
  beforeEach(async () => {
    await seed(`profiles/${ALICE}`, profileFor(ALICE));
  });

  it('lets the owner read their profile', async () => {
    await assertSucceeds(getDoc(doc(db(ALICE), 'profiles', ALICE)));
  });

  it('keeps profiles private from other players', async () => {
    await assertFails(getDoc(doc(db(BOB), 'profiles', ALICE)));
  });

  it('keeps profiles private from signed-out clients', async () => {
    await assertFails(getDoc(doc(anonDb(), 'profiles', ALICE)));
  });

  it('refuses a listing of every profile', async () => {
    await assertFails(getDocs(collection(db(ALICE), 'profiles')));
  });
});

describe('profiles/{uid} — updates', () => {
  beforeEach(async () => {
    // Seeded with real progression, not a fresh profile. A zeroed fixture would
    // make "reset my stats to 0" a no-op write, which the rules allow and which
    // would have passed as a false positive.
    await seed(
      `profiles/${ALICE}`,
      profileFor(ALICE, {
        xp: 4_000,
        level: 12,
        streak: { current: 18, longest: 22, lastPlayedDate: '2026-08-01', freezesUsed: 0 },
        stats: {
          played: 40,
          won: 31,
          totalMoves: 148,
          totalScore: 9_400,
          bestScore: 620,
          totalDurationMs: 1_800_000,
          dailyCompleted: 22,
          flawlessWins: 3,
          currentWinRun: 4,
          longestWinRun: 9,
        },
        badges: { first_light: { id: 'first_light', unlockedAt: 1_000 } },
      }),
    );
  });

  it('allows the identity edits the app actually makes', async () => {
    // Mirrors services/firestore/profiles.ts → updateIdentity()
    await assertSucceeds(
      updateDoc(doc(db(ALICE), 'profiles', ALICE), {
        displayName: 'Sharp Cipher',
        avatarId: 3,
        updatedAt: Date.now(),
      }),
    );
  });

  it('allows the settings edits the app actually makes', async () => {
    // Mirrors services/firestore/profiles.ts → updateSettings(), which uses a
    // merging set. If the rules counted the nested map as an unlisted field the
    // toggle switches in Settings would silently fail in production.
    await assertSucceeds(
      setDoc(
        doc(db(ALICE), 'profiles', ALICE),
        { settings: { haptics: false, theme: 'light' }, updatedAt: Date.now() },
        { merge: true },
      ),
    );
  });

  it('allows a dotted-path settings write too, so either style is safe', async () => {
    await assertSucceeds(
      updateDoc(doc(db(ALICE), 'profiles', ALICE), {
        'settings.haptics': false,
        updatedAt: Date.now(),
      }),
    );
  });

  it('refuses a merging set that smuggles progression alongside settings', async () => {
    await assertFails(
      setDoc(
        doc(db(ALICE), 'profiles', ALICE),
        { settings: { haptics: false }, xp: 999_999 },
        { merge: true },
      ),
    );
  });

  it('refuses a self-awarded XP or level change', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'profiles', ALICE), { xp: 999_999 }));
    await assertFails(updateDoc(doc(db(ALICE), 'profiles', ALICE), { level: 50 }));
  });

  it('refuses a self-awarded streak, badge or statistic', async () => {
    await assertFails(
      updateDoc(doc(db(ALICE), 'profiles', ALICE), { 'streak.current': 365 }),
    );
    await assertFails(
      updateDoc(doc(db(ALICE), 'profiles', ALICE), {
        'badges.level_50': { id: 'level_50', unlockedAt: 1 },
      }),
    );
    await assertFails(
      updateDoc(doc(db(ALICE), 'profiles', ALICE), { 'stats.bestScore': 100_000 }),
    );
  });

  it('refuses an identity edit smuggling a progression field alongside it', async () => {
    await assertFails(
      updateDoc(doc(db(ALICE), 'profiles', ALICE), {
        displayName: 'Sharp Cipher',
        xp: 999_999,
      }),
    );
  });

  it('refuses an invalid display name or avatar', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'profiles', ALICE), { displayName: 'x' }));
    await assertFails(
      updateDoc(doc(db(ALICE), 'profiles', ALICE), { displayName: 'x'.repeat(21) }),
    );
    await assertFails(updateDoc(doc(db(ALICE), 'profiles', ALICE), { avatarId: -1 }));
    await assertFails(updateDoc(doc(db(ALICE), 'profiles', ALICE), { avatarId: 1_000 }));
  });

  it('refuses laundering a bad run by overwriting the profile with a fresh one', async () => {
    // The obvious exploit once creation is locked down: wipe a broken streak or
    // a sunk win-rate by re-running the first-launch write over the top.
    await assertFails(setDoc(doc(db(ALICE), 'profiles', ALICE), profileFor(ALICE)));
  });

  it('refuses resetting statistics in place to launder a bad win rate', async () => {
    await assertFails(
      updateDoc(doc(db(ALICE), 'profiles', ALICE), { 'stats.played': 0, 'stats.won': 0 }),
    );
  });

  it('refuses dropping a badge to re-farm its unlock', async () => {
    await assertFails(
      updateDoc(doc(db(ALICE), 'profiles', ALICE), { badges: {} }),
    );
  });

  it('refuses another player editing this profile', async () => {
    await assertFails(
      updateDoc(doc(db(BOB), 'profiles', ALICE), { displayName: 'Hacked Name' }),
    );
  });

  it('refuses deletion — that path goes through the callable', async () => {
    await assertFails(deleteDoc(doc(db(ALICE), 'profiles', ALICE)));
  });
});

describe('session log and daily entries', () => {
  const session = {
    sessionId: 's1',
    uid: ALICE,
    moduleId: 'number-logic',
    variantId: 'two-digit',
    mode: 'daily',
    score: 300,
    xp: 150,
    status: 'won',
    finishedAt: 1_000,
  };

  beforeEach(async () => {
    await seed(`profiles/${ALICE}/sessions/s1`, session);
    await seed(`profiles/${ALICE}/dailyEntries/2026-08-01`, {
      challengeId: '2026-08-01',
      uid: ALICE,
      score: 300,
    });
  });

  it('lets the owner read their own history', async () => {
    await assertSucceeds(getDoc(doc(db(ALICE), 'profiles', ALICE, 'sessions', 's1')));
    await assertSucceeds(getDocs(collection(db(ALICE), 'profiles', ALICE, 'sessions')));
    await assertSucceeds(
      getDoc(doc(db(ALICE), 'profiles', ALICE, 'dailyEntries', '2026-08-01')),
    );
  });

  it('hides one player’s history from another', async () => {
    await assertFails(getDoc(doc(db(BOB), 'profiles', ALICE, 'sessions', 's1')));
    await assertFails(
      getDoc(doc(db(BOB), 'profiles', ALICE, 'dailyEntries', '2026-08-01')),
    );
  });

  it('refuses a client-written session — even its own', async () => {
    await assertFails(
      setDoc(doc(db(ALICE), 'profiles', ALICE, 'sessions', 's2'), { ...session, score: 99_999 }),
    );
    await assertFails(
      updateDoc(doc(db(ALICE), 'profiles', ALICE, 'sessions', 's1'), { score: 99_999 }),
    );
    await assertFails(deleteDoc(doc(db(ALICE), 'profiles', ALICE, 'sessions', 's1')));
  });

  it('refuses a client-written daily entry, which would forge a second attempt', async () => {
    await assertFails(
      setDoc(doc(db(ALICE), 'profiles', ALICE, 'dailyEntries', '2026-08-01'), {
        challengeId: '2026-08-01',
        uid: ALICE,
        score: 99_999,
      }),
    );
  });
});

describe('public read-only collections', () => {
  beforeEach(async () => {
    await seed(`publicProfiles/${ALICE}`, { uid: ALICE, displayName: 'Quiet Falcon', level: 12, xp: 4_000 });
    await seed('challenges/2026-08-01', {
      id: '2026-08-01',
      moduleId: 'number-logic',
      variantId: 'two-digit',
      seed: 'mindcode.v1:daily:2026-08-01:number-logic:two-digit',
    });
    await seed(`leaderboards/global/entries/${ALICE}`, {
      uid: ALICE,
      displayName: 'Quiet Falcon',
      score: 4_000,
      level: 12,
    });
  });

  it('lets any signed-in player read public profiles, challenges and boards', async () => {
    await assertSucceeds(getDoc(doc(db(BOB), 'publicProfiles', ALICE)));
    await assertSucceeds(getDoc(doc(db(BOB), 'challenges', '2026-08-01')));
    await assertSucceeds(getDocs(collection(db(BOB), 'leaderboards', 'global', 'entries')));
  });

  it('refuses signed-out reads', async () => {
    await assertFails(getDoc(doc(anonDb(), 'challenges', '2026-08-01')));
    await assertFails(getDocs(collection(anonDb(), 'leaderboards', 'global', 'entries')));
  });

  it('refuses a self-inserted leaderboard entry', async () => {
    await assertFails(
      setDoc(doc(db(BOB), 'leaderboards', 'global', 'entries', BOB), {
        uid: BOB,
        displayName: 'Cheater',
        score: 9_999_999,
        level: 50,
      }),
    );
  });

  it('refuses editing someone else’s leaderboard entry', async () => {
    await assertFails(
      updateDoc(doc(db(BOB), 'leaderboards', 'global', 'entries', ALICE), { score: 0 }),
    );
  });

  it('refuses rewriting a daily challenge to an easier puzzle', async () => {
    await assertFails(
      updateDoc(doc(db(ALICE), 'challenges', '2026-08-01'), { seed: 'known-seed' }),
    );
  });

  it('refuses inflating a public profile', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'publicProfiles', ALICE), { xp: 9_999_999 }));
  });
});

describe('default deny', () => {
  it('refuses reads and writes to undeclared collections', async () => {
    await assertFails(getDoc(doc(db(ALICE), 'admin', 'secrets')));
    await assertFails(setDoc(doc(db(ALICE), 'anythingElse', 'x'), { a: 1 }));
    await assertFails(setDoc(doc(db(ALICE), 'profiles', ALICE, 'somethingNew', 'x'), { a: 1 }));
  });
});
