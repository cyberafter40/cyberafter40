# Architecture

## The one decision everything follows from

MindCode ships as a number-guessing game, but the brief is a brain-training
platform. Those two things want opposite code. A game wants the rules close to
the screen; a platform wants the rules nowhere near it.

So the codebase is organised around a single constraint: **no layer above the
engines may know what game is being played.** The result screen, the profile,
the leaderboard, the analytics funnel, the Firestore schema and the Cloud
Functions are all written against normalised shapes — `GameOutcome`,
`ScoreBreakdown`, `ProgressEvent` — that a memory game or a reaction test will
produce just as naturally as the number puzzle does.

That claim has now been tested rather than asserted: **Memory Grid shipped as a
second engine**, in a different category, with a different scoring shape. What
it cost, measured:

| | |
| --- | --- |
| New files | 5, all under `src/games/memoryGrid/` |
| Registry edits | 2 lines in `src/games/index.ts`, 2 in `src/games/renderers.tsx` |
| Scoring | 1 new `ScoringProfile` — composed from existing rules, no new rule code |
| Progression, statistics, persistence, security rules, Cloud Functions, navigation | **unchanged** |
| Backend | validated the new game with no edits at all — engines resolve through the registry |

One thing the claim got wrong, and it is worth recording: `HomeScreen` had
`'number-logic'` hardcoded in its free-play section. Adding a second game
exposed it immediately. It is now driven by `listLiveGameModules()`, so a third
module appears there with no edit — but the leak was real, and it is the kind
only a second implementation finds.

`__tests__/platform.test.ts` exists to keep this honest: it drives a memory game
through the unmodified scoring and progress engines and asserts the results are
meaningful, not merely non-crashing. See
[GAME_ENGINE_GUIDE.md](GAME_ENGINE_GUIDE.md) for the procedure.

---

## Layers

```
┌─────────────────────────────────────────────────────────────┐
│ screens/  navigation/          React, RN, navigation         │
├─────────────────────────────────────────────────────────────┤
│ state/                         contexts, hooks               │
├─────────────────────────────────────────────────────────────┤
│ services/                      Firebase, storage, analytics  │
├─────────────────────────────────────────────────────────────┤
│ games/                         concrete game modules         │
├─────────────────────────────────────────────────────────────┤
│ engine/   scoring/   progress/  daily/   utils/              │
│                                PURE — no React, no Firebase  │
└─────────────────────────────────────────────────────────────┘
```

The bottom band is the important one. It has no imports from `react`,
`react-native` or `firebase` — a property that is not aspirational but load
bearing, because those exact files are compiled a second time into the Cloud
Functions (`functions/tsconfig.json` includes `../src/engine`, `../src/scoring`,
`../src/progress`, `../src/games`, `../src/daily`). The server does not
reimplement the game; it *is* the game.

You can verify the boundary at any time:

```bash
grep -rn "from 'react\|from 'firebase\|from '@/services" \
  src/engine src/scoring src/progress src/games src/daily src/utils --include=*.ts
```

Anything it prints is a bug.

---

## The three engines

### 1. Game Engine — `src/engine/`

A `GameEngine<TState, TMove, TFeedback, TConfig>` is a pure state machine:

```ts
createInitialState({ config, rng, startedAt }) → TState
validateMove(state, move)                     → MoveValidation
applyMove(state, move, at)                    → { state, feedback }
isTerminal(state)                             → boolean
getOutcome(state, at)                         → GameOutcome
```

Three rules for implementers, all of them consequences of the same goal
(replayability):

- **No `Date.now()`.** Time is a parameter.
- **No `Math.random()`.** Randomness comes from the injected seeded `Rng`.
- **JSON-serialisable state.** A session must survive a round trip through
  Firestore.

`GameOutcome` is the narrow waist of the whole system:

```ts
{ status, movesUsed, maxMoves, durationMs, accuracy, metrics }
```

`accuracy` is the interesting field — a normalised 0..1 measure of *quality of
play*, defined by each engine. For the number game it is information-theoretic:
the fraction of remaining uncertainty each guess eliminated, measured against
the candidate set that survives the feedback the player actually saw. A reaction
test would define it as hit rate. Scoring rules consume `accuracy` and never
look inside an engine.

`GameSession` (`src/engine/session.ts`) is the runtime that drives any engine:
it holds state, records a labelled history, detects termination, and emits a
`GameResult` — the single transport object used by scoring, persistence and
server-side validation alike.

### 2. Scoring Engine — `src/scoring/`

Scoring is a list of rules, not a function:

```ts
computeScore(profile, { result, module, player }) → ScoreBreakdown
```

Each `ScoringRule` decides whether it applies and returns a component that
either adds a flat amount or multiplies the running total. Order is the economy:
additive rules build the raw score (completion, move efficiency, deduction
quality, first-try bonus, speed) and multiplicative rules scale it (Daily
Challenge ×1.5, streak up to ×1.5).

Two things follow from making this data:

- The result screen can itemise *why* a score was what it was, which is what
  teaches players that efficient deduction pays better than lucky guessing.
- Retuning the economy, or scoring a completely different game type, is a new
  `ScoringProfile` — no engine or UI changes. `reflexScoringProfile` already
  exists as the shape a reaction-test module will use.

The streak multiplier is capped at 1.5× deliberately. An uncapped streak bonus
makes leaderboards unreachable for anyone who missed a week, which converts a
motivator into a reason to stop playing.

### 3. User Progress Engine — `src/progress/`

One pure reducer:

```ts
applyGameResult({ profile, result, score, now }) → { profile, events }
```

It owns XP, the 50-level curve and its titles, aggregate statistics
(pre-aggregated, never derived by counting session documents), streaks, and
badge evaluation. Badges are declarative predicates over the *post-update*
profile, so "reach level 10" and "win ten in a row" are data, not code paths —
including badges for games that do not exist yet, since a predicate can key off
`result.moduleId`.

Purity here is what makes the optimistic UI safe: the client runs this reducer
to animate the result screen instantly, the Cloud Function runs the identical
reducer to write the authoritative document, and the two cannot disagree.

---

## Data flow of one game

```
HomeScreen
  └─ derives today's challenge locally (pure function of the UTC date)
       ↓
GameScreen ── useGameSession ── GameSession ── numberLogicEngine
       ↓                              (renderer resolved from module.renderer)
  game ends
       ↓
submitResult()
  ├─ computeScore()      ─┐  optimistic: result screen animates immediately
  ├─ applyGameResult()   ─┤
  ├─ cache to AsyncStorage┘
  └─ callable submitGameResult ──► Cloud Function
                                     ├─ regenerate puzzle from seed
                                     ├─ replay every move through the engine
                                     ├─ recompute score + progression
                                     └─ one transaction:
                                        profile, session, dailyEntry,
                                        publicProfile, 3 leaderboards
       ↓
onSnapshot(profile) quietly corrects the optimistic state
```

If the callable fails, the result is queued in AsyncStorage and flushed on the
next foreground or sign-in. Deterministic session ids (`uid_YYYY-MM-DD` for
daily games) make retries idempotent.

---

## Anti-cheat and its limits

What the backend enforces, in `functions/src/replay.ts`:

| Check | Blocks |
| --- | --- |
| Seed must match `deriveDailyChallenge(challengeId)` | replaying an easier day's puzzle |
| Every move re-validated and re-applied through the engine | illegal or fabricated moves |
| Outcome recomputed, client's outcome discarded | forged wins and move counts |
| Score recomputed from the server's own profile read | inflated streak/personal-best multipliers |
| `finishedAt − startedAt ≥ moves × 250 ms` | instant-solve bots |
| Timestamps not in the future, not older than 7 days | clock manipulation, stale replays |
| `sessionId` uniqueness inside the transaction | double-counting a daily attempt |
| Firestore rules deny all client writes to progression | writing XP directly |

Every row is covered by tests, across three suites:

| Suite | Covers | Needs |
| --- | --- | --- |
| `functions/__tests__/replay.test.ts` | forged games — seeds, moves, timings, payload shape | nothing |
| `functions/__tests__/emulator/submitGameResult.test.ts` | the write transaction: idempotency, the six documents, server-side scoring | Firestore emulator |
| `functions/__tests__/emulator/firestore.rules.test.ts` | every allow/deny path in `firestore.rules` | Firestore emulator |
| `functions/__tests__/emulator/deleteAccount.test.ts` | full erasure across every collection, and the auth record | Firestore + Auth emulators |
| `functions/__tests__/emulator/provisionDailyChallenges.test.ts` | create-only provisioning; never rewrites a live puzzle | Firestore emulator |
| `__tests__/ui/boards.test.tsx` | the real boards driven by the real engines — keypad wiring, reveal timing, hand-off | nothing |
| `e2e/daily-challenge.spec.ts` | the real bundled app in a browser, playing a real game against real auth, rules and `submitGameResult` | Firebase emulators + Chromium |

None of them use fixtures — each case drives a real `GameSession` and then
tampers with the result the way an attacker would.

Two properties are worth stating because they are easy to get wrong:

- **A forged `outcome` or `solution` is not rejected, it is overwritten.** The
  replayed truth replaces whatever the client sent, so no client-supplied field
  reaches the scorer at all. That is stronger than rejection, which would leave
  a version-skew failure mode.
- **One attempt per day is enforced by the transaction, not by the UI.** Daily
  session ids are deterministic (`{uid}_{YYYY-MM-DD}`), so a second attempt
  collides with an existing document inside the transaction and returns
  `duplicate` without touching XP, statistics or any leaderboard.

What it does **not** stop: a modified client that plays the real game correctly
but has a solver choose its guesses. The puzzle has to exist on the device for
the game to work offline, so the secret is recoverable by anyone determined
enough. This is the same trade-off every daily word game makes. The exposure is
bounded — a solver's score is capped at what a perfect legitimate game earns,
because the score is computed from the replayed outcome — and the mitigation if
it ever matters in practice is server-authoritative puzzles for competitive
boards only, which the seed indirection already makes a small change.

Firebase App Check is wired but disabled (`enforceAppCheck: false`) so the
project runs without a Play Integrity / DeviceCheck setup. Turn it on before a
public launch.

---

## Offline

The app is playable with no connection, which matters because "five minutes a
day" often means a commute:

- Today's challenge is **derived**, not fetched. The Firestore document only
  adds community stats.
- The profile is cached in AsyncStorage and painted before Firestore responds.
- Finished games queue locally and flush automatically, capped at 50 entries
  with 5 retries so a permanently rejected payload cannot wedge the queue.
- Auth persists through AsyncStorage, so a cold start offline is still signed in.

---

## Choices worth defending

**Anonymous-first auth.** A new player completes their first Daily Challenge
before seeing a form. Registering later *links* the credential to the same uid,
so streaks and XP survive the upgrade. Making a habit app ask for an email
before it has earned one is the most reliable way to never form the habit.

**Pre-aggregated statistics.** The profile document carries every headline
number. Opening the profile screen is one document read, works offline, and
costs the same whether the player has ten games or ten thousand.

**Denormalised leaderboard entries.** Each entry carries its own display name
and avatar, so a 50-row board is 50 reads rather than 100. The cost is a
stale name until that player's next game, which is the right trade.

**UTC everywhere.** "Same challenge for all users" and per-timezone dates are
incompatible. Every date key, streak boundary and leaderboard period is UTC.

**Gradient avatars, no uploads.** No storage bill, no image pipeline, and no
user-generated content to moderate before launch.

**Streaks reset to 1, not 0.** Losing a 40-day streak and landing on zero is an
uninstall. The current day still counts.

**Streaks count showing up, not winning.** A lost game keeps the streak. Winning
is what XP is for; consistency is what the streak is for.
