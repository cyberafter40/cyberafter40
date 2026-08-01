# MindCode

A five-minute daily logic game, built as a brain-training platform.

You get a hidden code. You guess. Every guess comes back as one number:

| Feedback | Meaning |
| --- | --- |
| `+1` per digit | right digit, right position |
| `−1` per digit | right digit, wrong position |
| `0` | digit is not in the code |

```
Hidden code: 82

  56  →   0     neither digit appears
  28  →  −2     both digits right, both misplaced
  82  →  +2     solved
```

The score you see is the **total**, and that total is often ambiguous — `0`
might mean nothing matched, or one exact hit cancelled by one misplaced digit.
Working out which is the game.

---

## What is here

| | |
| --- | --- |
| **App** | React Native (Expo, TypeScript) |
| **Backend** | Firebase — Auth, Firestore, Cloud Functions, Analytics |
| **Modes** | Daily Challenge (one attempt, same code worldwide) · Classic (2/3/4 digits) |
| **Progression** | XP, 50 levels with titles, 19 badges, daily streaks |
| **Social** | Daily / weekly / all-time leaderboards |
| **Tests** | 104 tests — 77 over the engine, scoring and progression layers, 27 over server-side result validation |

### Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the three-engine design and why it is shaped this way
- [`docs/GAME_ENGINE_GUIDE.md`](docs/GAME_ENGINE_GUIDE.md) — how to add a new brain-training module
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — Firestore collections, indexes and access rules
- [`docs/UI_SCREENS.md`](docs/UI_SCREENS.md) — screen inventory and design system
- [`docs/DEPLOYMENT_APPSTORE.md`](docs/DEPLOYMENT_APPSTORE.md) — Firebase setup through App Store submission
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what ships after v1

---

## Running it

```bash
npm install
cp .env.example .env          # fill in from the Firebase console
npx expo start                # press i for iOS, a for Android
```

Without Firebase credentials the app will still build, but sign-in and sync will
fail on launch — see [`docs/DEPLOYMENT_APPSTORE.md`](docs/DEPLOYMENT_APPSTORE.md)
for the ten-minute project setup.

```bash
npm test          # 77 domain tests — no emulator or network needed
npm run typecheck # full app type check
npm run lint
```

Backend:

```bash
cd functions && npm install && npm run build
npm test                                       # 27 result-validation tests
firebase emulators:start                       # local Auth + Firestore + Functions
```

From the repo root, `npm run test:all` runs both suites.

```bash
npm run deploy:rules && npm run deploy:functions
```

---

## Architecture in one paragraph

MindCode is not a game with some structure around it; it is a small platform
with one game in it. Three pure, dependency-free engines do the work — a
**Game Engine** (rules), a **Scoring Engine** (what a result is worth) and a
**User Progress Engine** (XP, levels, streaks, badges) — and none of them knows
what Bulls & Cows is. The `+1/−1` rule itself is a swappable
[`FeedbackPolicy`](src/games/numberLogic/policies.ts), not a hardcoded branch.
Adding memory, pattern, reaction or reasoning games means writing a `GameEngine`
and registering it; scoring, progression, statistics, persistence, analytics and
navigation all keep working untouched.

Those same pure modules are compiled into the Cloud Functions, so the server
replays every submitted game with byte-identical logic instead of a
re-implementation that could drift.

```
src/
  engine/     GameEngine contract, seeded RNG, registry, session runtime
  scoring/    composable scoring rules and profiles
  progress/   XP curve, levels, badges, streaks, the progress reducer
  games/      numberLogic/ (live) + roadmap module stubs
  daily/      deterministic Daily Challenge derivation (shared with backend)
  services/   Firebase: auth, Firestore repositories, analytics, offline queue
  state/      React contexts and hooks
  ui/         design tokens and components
  screens/    the nine screens
functions/    submitGameResult · deleteAccount · provisionDailyChallenges
```

---

## Notes on fairness

Every puzzle is a pure function of a seed, and the Daily Challenge seed is
derived from the UTC date — so the app can generate today's code offline and the
backend can regenerate it to verify a submission. Results are replayed
server-side before any XP is written; forged move counts, mismatched seeds,
out-of-order moves and implausibly fast solves are all rejected, and duplicate
session ids are ignored so a daily attempt can never be counted twice.

A determined player running a solver against a client-side puzzle cannot be
fully prevented — no offline-playable puzzle game can do that. The exposure is
bounded rather than eliminated, and that trade-off is documented in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#anti-cheat-and-its-limits).
