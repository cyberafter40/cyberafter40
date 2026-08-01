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

## v1.2 — more modules

**Memory Grid shipped in v1**, which was the release meant to prove the platform
claim. It mostly held: five new files, four lines in two existing ones, a new
`ScoringProfile`, and no changes at all to progression, persistence, security
rules or the backend. It also found one genuine leak — `HomeScreen` had a game
id hardcoded — which is exactly what a second implementation is for.

Next: Pattern Sense, Reaction Lab and Deduction Room, all three already
registered as locked cards in `src/games/upcoming.ts` with real metadata.

**Cross-module Daily Challenge rotation.** The daily is single-module in v1
(`DEFAULT_MODULE_ID`), and Memory Grid ships with an empty `dailyVariantPool`
because of it. `deriveDailyChallenge` already selects by module id, so this is a
small change — rotate the module as well as the variant, and give each module a
non-empty pool.

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

**Index requirements are unverified.** 190 tests now cover the domain layers,
server-side replay, `firestore.rules` and all three Cloud Functions — but the
Firestore emulator does not enforce indexes, so no test can prove a query will
work against a real project. `deleteAccount`'s collection-group sweep over
`entries.uid` needs the `COLLECTION_GROUP` override now declared in
`firestore.indexes.json`; it was missing until it was found by reading rather
than by testing. Deploy indexes before functions and exercise account deletion
once on staging.

**No end-to-end test on a device.** Everything below the React layer is tested;
nothing above it is. No component tests, no Detox/Maestro run, no screenshot
regression. This is now the largest gap by some distance — and Memory Grid
widened it, because `MemoryGridBoard` carries real timing logic (the reveal
sequence) that no test touches. The first bug that reaches a user will probably
be a rendering or timing one, not a scoring one.

**How to Play only covers Number Logic.** `HowToPlayScreen` is the ±1 explainer
and is hardcoded to that module. Memory Grid teaches itself on the board
("Watch" → "Repeat it"), so nothing is broken, but the screen should take a
module id and render per-module rules now that there is more than one game.
