# Web MVP

A playable build of MindCode that runs anywhere a browser does — one HTML file,
no server, no network, no accounts.

```bash
npm run build:webmvp     # → webmvp/dist/mindcode.html
```

Open that file on a phone and the game works: today's Daily Challenge, both
game modules, XP, levels, streaks, badges, and English/Turkish.

## Why this exists

The native app cannot be put in a tester's hands yet. It needs a Firebase
project to sign a player in, and it needs an Apple Developer account to reach
a device at all — both of which are external prerequisites, not code.

This build removes both. It is how the game gets in front of real people
*before* the store paperwork clears, which is the difference between guessing
at retention and measuring it.

## What is real, and what is not

Everything that decides what happens in a game is imported verbatim from
`src/`, not reimplemented:

| Imported as-is | What it gives you |
| --- | --- |
| `src/engine` | the `GameSession` runtime and the seeded RNG |
| `src/games` | both live modules and all their rules |
| `src/daily` | the Daily Challenge derivation |
| `src/scoring` | the scoring pipeline and rating |
| `src/progress` | XP, levels, streaks, badge unlocks |
| `src/i18n` | the message catalogues |

So the code you play here today is the same code the native app runs and the
same code `submitGameResult` replays server-side. Today's puzzle is byte-for-byte
the puzzle the shipped app would generate.

Two things are swapped out, and only two:

- **React Native → plain DOM.** The screens are re-implemented in `app.ts`.
  They follow the same layout and design tokens, but they are not the same
  components — this build cannot catch a bug in a React Native screen.
- **Firestore → `localStorage`.** Progress lives in one browser on one device.

Consequently there is **no account, no sync, no leaderboard and no server-side
validation**. A player here could edit their own score in devtools; that is
fine, because nothing they do leaves the device.

## Files

| | |
| --- | --- |
| `app.ts` | the shell: screens, persistence, input |
| `styles.css` | design tokens mirrored from `src/ui/theme.ts` |
| `build.mjs` | esbuild → a single inlined HTML file |
| `dist/mindcode.html` | standalone document — open it, mail it, host it |
| `dist/mindcode.fragment.html` | same bundle for hosts that supply their own `<head>` |

`dist/` is generated and gitignored.

## Installing it like an app

The build carries the iOS and Android web-app meta tags, so **Share → Add to
Home Screen** gives it an icon, a splash colour and no browser chrome. That is
close enough to a native shell to run an honest usability session.

## Keeping it in step

`styles.css` duplicates the palette from `src/ui/theme.ts` because that file
imports `react-native`, which has no place in a browser bundle. When the palette
moves, move both.

Nothing else is duplicated. If a game rule, a scoring weight or a translation
changes in `src/`, this build picks it up on the next `npm run build:webmvp`.
