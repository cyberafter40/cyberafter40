# Adding a brain-training module

The platform claim in [ARCHITECTURE.md](ARCHITECTURE.md) is only worth
something if it is cheap to act on. This is the whole procedure — and it is
described from experience, not from intent: **Memory Grid** was built this way
and ships in v1. Read `src/games/memoryGrid/` alongside this document.

**You write:** an engine, a module descriptor, a renderer.
**You edit:** two lines in `src/games/index.ts`, two in `src/games/renderers.tsx`.
**You may add:** a `ScoringProfile`, if the stock rules do not suit your game.
Memory Grid needed one — see step 2.
**You do not touch:** progression, statistics, persistence, security rules,
Cloud Functions, or navigation.

What building the second module actually taught us, which the first version of
this guide got wrong: it also found a hardcoded `'number-logic'` in
`HomeScreen`. If your module does not appear on the home screen, that is the
class of bug to look for — a screen naming a game instead of asking the
registry.

---

## 1. The engine

```
src/games/memoryGrid/          ← a real, working example; read it
  generator.ts        config type + seeded puzzle generation
  engine.ts           the rules
  module.ts           the GameModule descriptor
  MemoryGridBoard.tsx the play surface
  index.ts
```

The sketch below is Memory Grid in outline; the shipped version is fuller.

```ts
// src/games/memoryGrid/engine.ts
import { invalid, VALID, type GameEngine } from '@/engine/types';

export interface MemoryGridConfig { size: number; sequenceLength: number;
                                    maxMistakes: number; revealMs: number }
export interface MemoryGridState  { config: MemoryGridConfig; sequence: number[];
                                    entered: number[]; mistakes: number; taps: number;
                                    status: GameStatus; startedAt: number; finishedAt: number | null }
export interface MemoryGridMove   { tile: number }

export const memoryGridEngine: GameEngine<
  MemoryGridState, MemoryGridMove, MemoryGridFeedback, MemoryGridConfig
> = {
  id: 'memory-grid',
  version: 1,

  createInitialState({ config, rng, startedAt }) {
    return {
      config,
      sequence: Array.from({ length: config.sequenceLength },
                           () => rng.nextInt(0, config.size ** 2 - 1)),
      entered: [], mistakes: 0, status: 'in_progress', startedAt, finishedAt: null,
    };
  },

  validateMove(state, move) {
    if (state.status !== 'in_progress') return invalid('game_over', 'This game has finished.');
    if (move.tile < 0 || move.tile >= state.config.size ** 2)
      return invalid('out_of_range', 'That tile is not on the grid.');
    return VALID;
  },

  applyMove(state, move, at) { /* … returns { state, feedback } … */ },

  isTerminal: (state) => state.status !== 'in_progress',

  getOutcome(state, at) {
    return {
      status: state.status === 'in_progress' ? 'abandoned' : state.status,
      movesUsed: state.taps,
      maxMoves: state.config.sequenceLength + state.config.maxMistakes,
      durationMs: (state.finishedAt ?? at) - state.startedAt,
      // Precision: what fraction of taps landed. A perfect run is 1.
      accuracy: state.taps === 0 ? 0 : state.entered.length / state.taps,
      metrics: { sequenceLength: state.config.sequenceLength, mistakes: state.mistakes },
    };
  },

  abandon: (state, at) => ({ ...state, status: 'abandoned', finishedAt: at }),
  revealSolution(state) {
    if (state.status === 'in_progress') throw new Error('Game still in progress');
    return state.sequence.join('-');
  },
  describeMove: (move, feedback) => `Tile ${move.tile} → ${feedback.correct ? '✓' : '✕'}`,
};
```

### The three rules, and why they exist

| Rule | Reason |
| --- | --- |
| No `Date.now()` — time arrives as `at` | the server replays sessions; a wall clock makes that impossible |
| No `Math.random()` — use the injected `rng` | the Daily Challenge must be identical worldwide and re-derivable |
| State must be JSON-serialisable | sessions are persisted, transported and replayed |

Break any of them and the engine still *works* — right up until a result is
rejected by the backend or a daily challenge differs between two phones.

### Getting `accuracy` right

This is the only field that needs thought. It is a normalised 0..1 measure of
**quality of play**, and it is what lets a single scoring rule set work across
completely different games. Pick something that distinguishes skill from luck:

| Module | Sensible `accuracy` |
| --- | --- |
| Number Logic | fraction of remaining uncertainty eliminated per guess |
| Memory Grid | correct taps ÷ total taps (this is what shipped) |
| Pattern Sense | correct predictions before the first mistake ÷ total |
| Reaction Lab | hit rate on go-trials, penalised by false alarms |

Do not use "1 if won else 0" — that throws away the signal the scoring engine
exists to reward.

---

## 2. The module descriptor

```ts
// src/games/memoryGrid/module.ts
import type { GameModule } from '@/engine/types';
import { recallScoringProfile } from '@/scoring/profiles';

export const memoryGridModule: GameModule<…> = {
  id: 'memory-grid',
  title: 'Memory Grid',
  tagline: 'Hold the pattern, then rebuild it.',
  category: 'memory',
  icon: '🧠',
  status: 'live',
  engine: memoryGridEngine,
  variants: [
    { id: 'short', title: 'Four Tiles', subtitle: 'A gentle warm-up.', difficulty: 1,
      unlocksAtLevel: 0,
      config: { size: 3, sequenceLength: 4, maxMistakes: 2, revealMs: 620 } },
    { id: 'long', title: 'Nine Tiles', subtitle: 'Serious recall.', difficulty: 5,
      unlocksAtLevel: 5,
      config: { size: 4, sequenceLength: 9, maxMistakes: 3, revealMs: 500 } },
  ],
  dailyVariantPool: [],              // v1's daily rotation is single-module
  renderer: 'memory-grid',
  scoringProfileId: recallScoringProfile.id,
  scoring: { basePoints: 110, difficultyStep: 0.4 },
};
```

`variants` are difficulty rungs. `unlocksAtLevel` gates them behind progression
— the home screen renders locked variants automatically. `dailyVariantPool`
declares which variants the Daily Challenge may rotate through.

If the stock rules do not fit, write a new `ScoringProfile` in
`src/scoring/profiles.ts` from the rules in `src/scoring/rules.ts` (or add new
ones). You are composing a list, not writing a scoring function.

Memory Grid needed exactly this, and the reason generalises. `moveEfficiencyRule`
pays for finishing under budget — but a flawless recall run uses its whole tap
budget minus the mistake allowance, so efficiency would have paid out for
playing *badly*, and `firstTryRule` could never fire at all. `recallScoringProfile`
drops both and leans on `deductionRule`, which reads the engine's `accuracy`.

The lesson: **check every stock rule against your engine's definition of
`movesUsed`.** Rules that assume move economy do not transfer to games where the
move count is fixed by construction.

---

## 3. The renderer

A React component receiving the generic session:

```tsx
// src/games/memoryGrid/MemoryGridBoard.tsx
export function MemoryGridBoard({ session, onFinished }: GameRendererProps) {
  const state = session.state<MemoryGridState>();

  const tap = (tile: number) => {
    const outcome = session.submitMove({ tile });
    if (!outcome.accepted) return;              // shake/error already handled
    if (outcome.terminal) setTimeout(onFinished, 500);
  };

  return /* … your board … */;
}
```

`session.submitMove` validates, applies, records history and re-renders.

**Use the returned `outcome.terminal`, not `session.isOver`.** Everything on the
session value is a render-time snapshot; immediately after the winning move it
still reads `false`, because the re-render has not happened yet. The return
value is the only thing that describes the move you just made. The same applies
to `getResult()`, which is a function for exactly this reason.

The host screen owns scoring, persistence and the transition to the result
screen — a renderer never touches them.

---

## 4. Register it

Two lines, in two files that already exist:

```ts
// src/games/index.ts
for (const module of [numberLogicModule, memoryGridModule, ...upcomingModules]) {
```

```tsx
// src/games/renderers.tsx
const renderers = {
  'number-pad': NumberPadBoard,
  'memory-grid': MemoryGridBoard,   // ← the key from module.renderer
  unavailable: UnavailableBoard,
};
```

Also remove the module's placeholder from `src/games/upcoming.ts` if it has one.

That is the entire integration. What now works without further edits:

- It appears on the home screen, with unlocked and locked variants rendered
  correctly for the player's level.
- It can be selected for the Daily Challenge.
- Games are scored, XP is awarded, levels advance, streaks update.
- Per-module and per-variant statistics accumulate on the profile.
- Badges keyed to `result.moduleId` start firing.
- Sessions are written to Firestore, leaderboards update, offline results queue.
- The Cloud Function replays and validates it — because
  `functions/tsconfig.json` already compiles `../src/games/**`.
- Analytics events carry the new `moduleId` with no schema change.

---

## 5. Test it

Mirror `__tests__/numberLogicEngine.test.ts`. The properties worth asserting for
any engine:

```ts
it('is fully determined by its seed', …)          // same seed → same puzzle
it('is replayable', …)                            // same seed + moves → same state
it('hides the solution until terminal', …)
it('rejects moves after the game ends', …)
it('keeps accuracy within 0..1', …)
it('round-trips through JSON unchanged', …)
```

Run with `npm test` — no emulator, no network, no React.

Your engine is also picked up automatically by the backend suite
(`npm run test:functions`), because `validateAndReplay` resolves engines through
the same registry. If your engine is not deterministic, that suite is where it
will show up.

---

## Roadmap modules already registered

`src/games/upcoming.ts` registers Memory Grid, Pattern Sense, Reaction Lab and
Deduction Room with real metadata and a `notImplementedEngine` that throws if
played. They render as locked cards on the home screen from the same list that
renders the live game. Replacing one of those stub engines with a real one is
the exercise above.
