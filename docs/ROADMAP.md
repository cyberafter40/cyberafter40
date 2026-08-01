# Roadmap

v1 is a complete daily game. Everything below is sequenced by what the
architecture already supports, cheapest and highest-signal first.

---

## v1.1 — sharpen the loop

| | |
| --- | --- |
| **Push notifications** | The `dailyReminder` setting already exists but nothing sends. One notification, only when a streak is genuinely at risk (`isStreakAtRisk` already computes this). Needs `expo-notifications` + an FCM scheduled function. |
| **Streak freezes** | `StreakState.freezesUsed` is reserved. Earn one every 10 days, spend it automatically on a missed day. The single highest-leverage retention feature in any streak app. |
| **Share cards** | v1 shares text. A rendered image of the guess history (spoiler-free — scores only, never digits) is what actually spreads. |
| **Hint system** | `isConsistent` in `matching.ts` is the structural primitive, already written and unused. A hint costs XP and rules out one digit. |

## v1.2 — the second game

Memory Grid, following [GAME_ENGINE_GUIDE.md](GAME_ENGINE_GUIDE.md) exactly.
This is the release that proves the platform claim: if it needs schema changes,
scoring changes or new screens, the abstraction was wrong and should be fixed
before a third game compounds the mistake.

Then Pattern Sense, Reaction Lab and Deduction Room — all four are already
registered as locked cards in `src/games/upcoming.ts` with real metadata.

A cross-module Daily Challenge rotation follows naturally: `dailyVariantPool`
and `deriveDailyChallenge` already select by module id.

## v1.3 — training, not just playing

Once several modules exist, the platform can say something a single game cannot:

- **Cognitive profile** — per-category strengths from the `accuracy` metric each
  engine already reports. "Your deduction is strong; your working memory lags."
- **Adaptive difficulty** — pick tomorrow's variant from recent accuracy instead
  of a fixed rotation.
- **Training plan** — a five-minute session mixing modules by weakest category.

This is the actual product thesis, and none of it needs new infrastructure —
only more engines feeding the same normalised metrics.

## v2 — social and sustainability

- **Friends and private leagues** — the leaderboard collection is already keyed
  by arbitrary `periodId`; a league is `leaderboards/league_{id}`.
- **Head-to-head** — same seed, two players, compare guess counts. The seeded
  RNG makes fairness free.
- **MindCode Plus** — unlimited practice, full history, detailed cognitive
  reports, streak insurance. Daily Challenge and core progression stay free
  forever; charging for the habit itself would kill the habit.

---

## Known limitations in v1

Stated plainly so they are decisions rather than surprises.

**Client-side puzzle generation.** Required for offline play; means a determined
player can extract the secret. Bounded by server-side replay and score
recomputation, not eliminated. See
[ARCHITECTURE.md](ARCHITECTURE.md#anti-cheat-and-its-limits).

**App Check is off.** `enforceAppCheck: false` so the project runs without
DeviceCheck/App Attest configured. Turn it on before public launch.

**No display-name moderation.** Names are validated for length and printable
characters only. A blocklist or moderation queue is needed before the app is
large enough to attract abuse.

**Leaderboards are unpaginated.** Top 50 plus the player's own pinned row. Fine
at launch scale; a rolled-up top-N document is the fix, sketched in
[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md#cost-model).

**Analytics needs a native transport.** The JS SDK cannot do RN Analytics; the
façade is in place and the adapter is ten lines
([DEPLOYMENT_APPSTORE.md §3](DEPLOYMENT_APPSTORE.md#3-native-analytics-optional-but-recommended)).

**Placeholder artwork.** `assets/` holds generated geometric placeholders.
Replace before submission — Apple rejects placeholder icons.

**Weekly leaderboard XP is incremented, not recomputed.** If a submission is
ever retried after a partial transaction failure the weekly total could drift.
Firestore transactions make this unlikely; a weekly reconciliation job would
make it impossible.

**Security rules and the write transaction are untested.** The 104 tests cover
the pure domain layers and the whole server-side validation path
(`functions/__tests__/replay.test.ts`), but two things are still only verified
by hand: `firestore.rules`, and the transaction body of `submitGameResult` —
idempotency on duplicate session ids, and the six documents it writes.

Both need the emulator: `@firebase/rules-unit-testing` for the rules, and
`firebase-functions-test` against the Firestore emulator for the transaction.
That is the next test investment, and it is the one that would catch a
regression in the rule that stops a client from bootstrapping itself onto the
leaderboard.
