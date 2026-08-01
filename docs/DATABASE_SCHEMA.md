# Database schema

Firestore, native mode. Paths are defined once in
[`src/services/firestore/schema.ts`](../src/services/firestore/schema.ts) and
referenced from the app, the rules and the Cloud Functions.

```
profiles/{uid}                              private, owner-read
  sessions/{sessionId}                      private, backend-write
  dailyEntries/{YYYY-MM-DD}                 private, backend-write
publicProfiles/{uid}                        world-read, backend-write
challenges/{YYYY-MM-DD}                     world-read, backend-write
leaderboards/{periodId}/entries/{uid}       world-read, backend-write
```

`periodId` is one of `global`, an ISO week (`2026-W31`), or a date
(`2026-08-01`).

---

## `profiles/{uid}`

The player's entire progression state, and the only document the app needs to
render the home and profile screens. Statistics are **pre-aggregated** rather
than counted from the session log: one read, instant render, constant cost.

```ts
{
  uid: string
  displayName: string          // 2–20 chars, client-writable
  avatarId: number             // index into a fixed gradient set
  countryCode: string | null
  isAnonymous: boolean
  createdAt: number            // epoch ms
  updatedAt: number

  xp: number
  level: number                // derived from xp; stored for queries

  streak: {
    current: number
    longest: number
    lastPlayedDate: string | null   // 'YYYY-MM-DD' UTC
    freezesUsed: number             // reserved for v1.1
  }

  stats: {
    played: number
    won: number
    totalMoves: number         // "number of attempts", all-time
    totalScore: number         // ÷ played = average solving score
    bestScore: number
    totalDurationMs: number
    dailyCompleted: number
    flawlessWins: number
    currentWinRun: number
    longestWinRun: number
  }

  // Per game module → per variant. Keyed by id so new modules need no migration.
  modules: {
    [moduleId: string]: {
      played, won, totalScore, bestScore, totalMoves, totalDurationMs: number
      variants: {
        [variantId: string]: {
          played, won, totalScore, bestScore: number
          bestMoves: number    // fewest guesses in a win; 0 = no win yet
          totalMoves, totalDurationMs: number
        }
      }
    }
  }

  badges:   { [badgeId: string]: { id: string, unlockedAt: number } }
  settings: { haptics, reducedMotion, dailyReminder: boolean, theme: 'system'|'light'|'dark' }

  schemaVersion: number        // forward-migrated on read
}
```

Derived on the client, never stored: `averageScore`, `averageMoves`, `winRate`,
`averageDurationMs`, and the level/title/progress-bar triple.

**Writes.** Only `displayName`, `avatarId`, `countryCode`, `settings` and
`updatedAt` are client-writable, enforced field-by-field in the rules. Every
progression field is written exclusively by `submitGameResult`.

---

## `profiles/{uid}/sessions/{sessionId}`

One document per finished game. Backend-written, owner-readable. Feeds the
"recent games" list and per-variant history — never the headline statistics.

```ts
{
  sessionId, uid, moduleId, variantId: string
  engineVersion: number        // stored so old rows stay interpretable
  mode: 'daily' | 'classic' | 'practice'
  challengeId: string | null
  seed: string                 // enough to fully reconstruct the game
  status: 'won' | 'lost' | 'abandoned'
  movesUsed, maxMoves, durationMs: number
  accuracy: number             // 0..1 deduction quality
  score, xp: number
  rating: 'flawless'|'excellent'|'solid'|'scraped'|'failed'
  moveLog: string[]            // ['82:+2', '56:0'] — compact, renderable
  solution: string
  startedAt, finishedAt, createdAt: number
}
```

`sessionId` is the document id, which is what makes submission idempotent.

## `profiles/{uid}/dailyEntries/{YYYY-MM-DD}`

The single Daily Challenge attempt for that date — the "one attempt history"
from the brief. The date-keyed document id is the enforcement mechanism: daily
session ids are deterministic (`{uid}_{YYYY-MM-DD}`), so a second attempt hits
the duplicate check inside the transaction and is ignored.

```ts
{
  challengeId, uid, sessionId: string
  status, score, xp, movesUsed, maxMoves, durationMs
  moveLog: string[]
  finishedAt: number
}
```

---

## `publicProfiles/{uid}`

A world-readable slice, so the full profile can stay private.

```ts
{ uid, displayName, avatarId, countryCode, level, xp, title,
  currentStreak, badgeCount, updatedAt }
```

## `challenges/{YYYY-MM-DD}`

The challenge is *derivable* — every client computes it from the date, which is
why the app works offline. This document exists to anchor community statistics
and to record which variant was live on which date.

```ts
{
  id, date: string             // both equal the document id
  moduleId, variantId, seed: string
  createdAt: number
  stats: { played, solved, totalMoves, totalScore: number }
}
```

Created by the `provisionDailyChallenges` scheduled function (23:55 UTC, three
days ahead so one failed run cannot leave a gap). It only ever *creates* —
rewriting a live challenge would change the puzzle under players mid-game.

## `leaderboards/{periodId}/entries/{uid}`

```ts
{
  uid, displayName, avatarId, countryCode, level: number
  score: number              // XP for global/weekly, game score for daily
  movesUsed?, durationMs?: number   // daily boards only, for tie-breaking
  updatedAt: number
}
```

| Board | `periodId` | `score` | Update |
| --- | --- | --- | --- |
| All-time | `global` | total XP | overwritten each submission |
| Weekly | `2026-W31` | XP that week | `FieldValue.increment(xp)` |
| Daily | `2026-08-01` | that day's score | overwritten (one attempt anyway) |

Entries are denormalised so a 50-row board costs 50 reads. The trade-off is a
stale display name until the player's next game.

---

## Indexes

Declared in [`firestore.indexes.json`](../firestore.indexes.json).

| Collection group | Fields | Query |
| --- | --- | --- |
| `sessions` | `moduleId ↑, variantId ↑, finishedAt ↓` | per-variant history |
| `sessions` | `mode ↑, finishedAt ↓` | daily vs classic history |
| `entries` | `score ↓, durationMs ↑` | leaderboard with speed tie-break |

Single-field indexes are disabled for `seed`, `solution` and `moveLog` — nothing
queries them and they are the largest fields in the collection.

---

## Access control

Full rules in [`firestore.rules`](../firestore.rules). The shape of the policy:

| Path | Read | Write |
| --- | --- | --- |
| `profiles/{uid}` | owner | owner: identity/settings fields only, validated. Create must be all-zeros |
| `profiles/{uid}/sessions/**` | owner | backend only |
| `profiles/{uid}/dailyEntries/**` | owner | backend only |
| `publicProfiles/**` | signed-in | backend only |
| `challenges/**` | signed-in | backend only |
| `leaderboards/**` | signed-in | backend only |
| everything else | denied | denied |

Two details worth calling out:

- **Profile creation is validated to be empty.** `xp == 0`, `level == 1`, no
  badges, zeroed stats. A client cannot bootstrap itself onto the leaderboard.
- **The rules never see the Cloud Functions.** The Admin SDK bypasses them
  entirely, which is precisely why every progression path goes through
  `submitGameResult` and why account deletion needs a callable.

---

## Cost model

A typical daily player performs, per day:

| Operation | Reads | Writes |
| --- | --- | --- |
| Open app (profile snapshot + challenge) | 2 | 0 |
| Play the Daily Challenge | 2 (in the transaction) | 6 |
| View a leaderboard | ~51 | 0 |

Leaderboard viewing dominates. If that becomes the bill, the fix is a single
rolled-up `leaderboards/{periodId}` document containing the top 50 as an array,
refreshed on a schedule — one read instead of fifty. The denormalised entry
shape is already what such a rollup would contain.

---

## Migrations

`schemaVersion` is checked on every profile read
([`profiles.ts`](../src/services/firestore/profiles.ts)). Forward migration
happens in memory at read time rather than as a batch job, so a player returning
after six months on a stale schema never sees a broken screen.
