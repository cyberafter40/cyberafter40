# UI screens and design system

## Design philosophy

The brief asked for minimal, premium, modern and calm — Wordle's restraint with
Duolingo's warmth. Four rules were enough to get there:

1. **Two neutral surfaces, one accent.** Colour is reserved for feedback (a
   guess score) and progress (XP, streak). Nothing is coloured to be decorative.
2. **One button shape.** 56pt tall, four tones. Every tap target clears 44pt.
3. **Large, confident numerals.** The code slots are the hero and should read at
   arm's length.
4. **Nothing pulses, bounces or nags.** A daily ritual should feel like a
   crossword, not a slot machine. Animations exist to explain state changes and
   then stop.

Tokens live in [`src/ui/theme.ts`](../src/ui/theme.ts): an 8pt spacing grid, a
five-step type scale, four radii, and light/dark palettes resolved by
`ThemeProvider` from the player's setting, falling back to the OS appearance.
Shadows are suppressed in dark mode — they read as mud on near-black — and a
lifted surface colour does the elevation work instead.

---

## Screens

### Onboarding — `OnboardingScreen.tsx`
Three cards, no account, no permission prompts. The middle card teaches the
±feedback using the **same `GuessRow` component the live board uses**, so the
tutorial cannot drift out of sync with the game. Skippable from card one.

### Home — `HomeScreen.tsx`
The main screen from the brief. Top to bottom:

- Avatar, display name, rank title, streak flame, XP progress bar
- **Daily Challenge card** — the one primary action. Before playing: the
  variant, the "same code for everyone today, one attempt" line, and a full-width
  play button. After playing: the result and a live countdown to the next
  challenge at midnight UTC. Community stats appear once the day has players.
- **One section per live game module**, rendered from the registry rather than
  from a hardcoded list — unlocked variants as tappable cards, locked ones
  dimmed with their unlock level. A third module appears here with no edit.
- **Coming to MindCode** — roadmap modules, rendered from the same registry list
  as the live game
- How to play

### Game — `GameScreen.tsx` + `NumberPadBoard.tsx`
The host screen owns the chrome (title, quit confirmation, transition to the
result) and delegates the board to whichever renderer the module declares. It
contains no game rules.

The board, top to bottom: **hidden number slots** → **guess history** →
**keypad**. History scrolls; the slots and keypad never move, so the board feels
like a fixed object rather than a page.

- Empty slots are outlined, not filled — the row reads as a question
- An invalid entry shakes the slot row (`react-native-reanimated` sequence)
- New history rows animate in from below, newest first
- Each row shows the guess, the score pill, and how many codes remain consistent
  with everything known — the deduction feedback loop made visible
- Keypad digits that cannot appear in the code are dimmed. They are still
  tappable: a "pointless" guess is part of thinking aloud
- Haptics: light on tap, medium on submit, success notification on a solve

### Game board: Memory Grid — `MemoryGridBoard.tsx`
The second play surface, hosted by the same `GameScreen`. Three phases: the
sequence plays back tile by tile, then the grid becomes tappable, then it hands
off. The reveal lives in the renderer rather than the engine — it is a
presentation concern, so keeping it here leaves the engine pure and replayable
and lets the timing be re-tuned (or skipped for accessibility) without touching
game logic.

Correct taps flash green, wrong ones red, and the header counts both progress
and remaining mistakes so the stakes are always legible.

### Result — `ResultScreen.tsx`
Reveals in one calm beat: outcome → the code → what it earned.

Score, XP, guesses and time as tiles, then an **itemised breakdown** — base,
efficiency, deduction, speed, daily ×1.5, streak ×1.3. Itemising is deliberate:
it teaches that efficient deduction pays better than lucky guessing, which is
the loop that makes players better, and better players return.

Below that, only what actually happened: personal best, level-up, streak, newly
unlocked badges. Share produces a spoiler-free score strip. An unsynced result
says so plainly rather than pretending.

### Leaderboard — `LeaderboardScreen.tsx`
Segmented control over Today / This week / All time. Medals for the top three,
the current user's row highlighted, and their own entry **pinned below the board
when they are outside the top 50** — a leaderboard that cannot answer "where am
I?" is discouraging rather than motivating. Pull to refresh.

### Profile — `ProfileScreen.tsx`
Avatar with level badge, rank title, XP bar with the next rank named. Then the
statistics the brief specified, as tiles: games played, win rate, **average
score**, **best score**, **average guesses** (with total attempts), average
time, **current streak** (with longest), daily challenges completed.

Below: a badge summary link, per-variant records, and the last ten games. Every
headline number comes from the pre-aggregated profile document, so the screen
renders offline and instantly; only the recent-games list needs the network and
it degrades to a quiet empty state.

### Badges — `BadgesScreen.tsx`
Grid of 21 badges, tier-coloured borders. Unlocked first, then visible locked,
then secrets — so the wall reads as an achievement record, not a to-do list.
Secret badges show as `❔` until earned.

### Settings — `SettingsScreen.tsx`
Display name, avatar picker, haptics / reduced motion / daily reminder toggles,
account state, sign out, **delete account**, and legal links.

### Auth — `AuthScreen.tsx`
Reached voluntarily, never as a gate. Copy is explicit that an account is about
*keeping* progress, because the player already has progress by the time they see
this screen. Sign-up pre-fills a generated display name.

### How to play — `HowToPlayScreen.tsx`
The rules by example, using live `GuessRow` components with the brief's own
worked example (`82` ← `56`, `28`, `82`), plus the Daily Challenge explanation
and one strategy tip.

---

## Components

[`src/ui/components/`](../src/ui/components/) — `Text` (the only text
primitive, which is what keeps the type scale honest), `Screen`, `Button`,
`Card`, `CodeSlots`, `Keypad`, `GuessRow`, `ProgressBar`, `StatTile`, `Avatar`,
`BadgeTile`, `SegmentedControl`, `EmptyState`.

`ErrorBoundary` wraps the app. It is styled inline with no theme dependency on
purpose: it must render even if the theme provider is what failed. A crashed
render in a daily-habit app is worse than a bug — it breaks the streak the
player has been protecting.

## Testing

`npm run test:ui` — 55 tests over three files, needing no emulator or network:

- **`components.test.tsx`** — reachability and communication: roles, labels,
  disabled states, the score pill's sign. Pixel styling is deliberately not
  asserted; it would break on every design tweak without catching a defect.
- **`boards.test.tsx`** — the real boards driven by the real `useGameSession`
  and the real engines. The secret is derived from the seed exactly as the app
  derives it, so pressing the right keys really does win. This is the only layer
  that can catch a keypad wired to the wrong handler, a board that never calls
  `onFinished`, or a reveal animation that leaves the grid untappable.
- **`screens.test.tsx`** — branch coverage per screen: daily played vs unplayed,
  locked vs unlocked variants, win vs loss, empty vs populated leaderboard.

Only the data supply is mocked (Firestore, auth, the profile). Theming, level
and streak derivation, statistics and the engines all run for real.

## Accessibility

- Every interactive element has an `accessibilityRole` and label; the code slots
  announce their contents, guess rows announce "Guess 2, 5 6, result 0"
- Tap targets ≥ 44pt throughout
- Colour is never the only signal — scores carry explicit `+`/`−` signs, and
  win/loss states use glyphs as well as hue
- A reduced-motion setting is exposed in Settings
- Text uses relative sizing and wraps rather than truncating
- Every composite that carries its own label sets `accessible`, so a screen
  reader announces the composed sentence rather than each child fragment. The
  UI suite enforces this by querying through `getByRole`, which only matches
  real accessibility elements — a label without the flag fails the test.
