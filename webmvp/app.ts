/**
 * MindCode — playable web MVP.
 *
 * A backend-free shell around the app's *real* domain layer. Everything that
 * decides what happens in a game is imported verbatim from `src/`:
 *
 *   src/engine     the GameSession runtime and seeded RNG
 *   src/games      both live modules and their rules
 *   src/daily      the Daily Challenge derivation
 *   src/scoring    the scoring pipeline
 *   src/progress   XP, levels, streaks, badges
 *   src/i18n       the message catalogues
 *
 * Only two things are replaced: React Native becomes plain DOM, and Firestore
 * becomes `localStorage`. That is deliberate — it means today's code here is
 * byte-identical to the code the native app and the Cloud Function run, so this
 * build is a faithful preview rather than a lookalike.
 *
 * What it is NOT: there is no account, no sync, no leaderboard and no server
 * validation. Progress lives in one browser on one device.
 */

import { GameSession, type GameResult } from '@/engine/session';
import { buildSeed } from '@/engine/rng';
import { getGameModule, getVariant, listLiveGameModules } from '@/engine/registry';
import { registerAllGameModules } from '@/games';
import { todaysChallenge } from '@/daily/challenge';
import type { NumberLogicFeedback, NumberLogicState } from '@/games/numberLogic/engine';
import { eliminatedDigits } from '@/games/numberLogic/engine';
import { getFeedbackPolicy } from '@/games/numberLogic/policies';
import type { MemoryGridFeedback, MemoryGridState } from '@/games/memoryGrid/engine';
import { computeScore, RATING_KEYS } from '@/scoring/scoringEngine';
import { getScoringProfile } from '@/scoring/profiles';
import type { ScoreBreakdown } from '@/scoring/types';
import { applyGameResult } from '@/progress/progressEngine';
import { describeLevel } from '@/progress/levels';
import { getBadge } from '@/progress/badges';
import { createProfile, type ProgressEvent, type UserProfile } from '@/progress/types';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_NAMES,
  resolveDeviceLocale,
  setLocale,
  SUPPORTED_LOCALES,
  t,
  type Locale,
  type TranslationKey,
  type TranslationParams,
} from '@/i18n';
import { formatCountdown, formatDuration, msUntilNextUtcDay, toDateKey } from '@/utils/date';

/* ------------------------------------------------------------------ *
 * Local persistence — the stand-in for Firestore
 * ------------------------------------------------------------------ */

const STORAGE_KEY = 'mindcode.webmvp.v1';

interface DailyEntry {
  challengeId: string;
  status: GameResult['outcome']['status'];
  score: number;
  movesUsed: number;
}

interface SaveFile {
  profile: UserProfile;
  dailyEntries: Record<string, DailyEntry>;
  locale: Locale | 'system';
}

function freshSave(): SaveFile {
  return {
    profile: createProfile({
      uid: 'local-player',
      displayName: 'Player',
      isAnonymous: true,
      now: Date.now(),
    }),
    dailyEntries: {},
    locale: 'system',
  };
}

function load(): SaveFile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshSave();
    const parsed = JSON.parse(raw) as Partial<SaveFile>;
    if (!parsed.profile) return freshSave();
    return {
      profile: parsed.profile,
      dailyEntries: parsed.dailyEntries ?? {},
      locale: parsed.locale ?? 'system',
    };
  } catch {
    // A corrupt save must not brick the app; start over rather than crash.
    return freshSave();
  }
}

function save(state: SaveFile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private browsing, quota — the game still plays, it just won't persist */
  }
}

/* ------------------------------------------------------------------ *
 * Tiny DOM helpers
 * ------------------------------------------------------------------ */

type Attrs = Record<string, string | number | boolean | undefined>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string | null)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Haptic feedback where the browser allows it. Silently absent on iOS Safari. */
function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

/* ------------------------------------------------------------------ *
 * App state
 * ------------------------------------------------------------------ */

registerAllGameModules();

/** The whole save file. Mutated in place, then written back by `save()`. */
const state = load();

function activeLocale(): Locale {
  if (state.locale !== 'system' && isSupportedLocale(state.locale)) return state.locale;
  return resolveDeviceLocale(navigator.languages ?? [navigator.language ?? DEFAULT_LOCALE]);
}

setLocale(activeLocale());

const root = document.getElementById('app') as HTMLElement;

type Screen =
  | { name: 'home' }
  | { name: 'game'; session: GameSession }
  | { name: 'result'; result: GameResult; score: ScoreBreakdown; events: ProgressEvent[] }
  | { name: 'howto' };

let screen: Screen = { name: 'home' };

function go(next: Screen): void {
  screen = next;
  render();
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}

/* ------------------------------------------------------------------ *
 * Finishing a game — the same pipeline the Cloud Function runs
 * ------------------------------------------------------------------ */

function finish(session: GameSession): void {
  const result = session.toResult();
  const module = getGameModule(result.moduleId);
  const level = describeLevel(state.profile.xp);

  const score = computeScore(getScoringProfile(module.scoringProfileId), {
    result,
    module: { id: module.id, ...module.scoring },
    player: {
      level: level.level,
      currentStreak: state.profile.streak.current,
      personalBest:
        state.profile.modules[result.moduleId]?.variants[result.variantId]?.bestScore ?? null,
    },
  });

  const update = applyGameResult({ profile: state.profile, result, score });
  state.profile = update.profile;

  if (result.mode === 'daily' && result.challengeId) {
    state.dailyEntries[result.challengeId] = {
      challengeId: result.challengeId,
      status: result.outcome.status,
      score: score.total,
      movesUsed: result.outcome.movesUsed,
    };
  }

  save(state);
  go({ name: 'result', result, score, events: update.events });
}

/* ------------------------------------------------------------------ *
 * Shared pieces
 * ------------------------------------------------------------------ */

function progressBar(ratio: number, label?: string): HTMLElement {
  return el('div', { class: 'bar', role: 'progressbar', 'aria-label': label ?? '', 'aria-valuenow': Math.round(ratio * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 }, [
    el('span', { style: `width:${Math.max(0, Math.min(1, ratio)) * 100}%` }),
  ]);
}

function statTile(label: string, value: string, hint?: string): HTMLElement {
  return el('div', { class: 'stat' }, [
    el('span', { class: 'stat-label', text: label }),
    el('span', { class: 'stat-value', text: value }),
    hint ? el('span', { class: 'stat-hint', text: hint }) : null,
  ]);
}

function topBar(title: string, onBack: () => void): HTMLElement {
  const back = el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('game.leave') }, ['✕']);
  back.addEventListener('click', onBack);
  return el('header', { class: 'topbar' }, [
    back,
    el('span', { class: 'topbar-title', text: title }),
    el('span', { class: 'topbar-spacer' }),
  ]);
}

/* ------------------------------------------------------------------ *
 * Home
 * ------------------------------------------------------------------ */

function renderHome(): HTMLElement {
  const level = describeLevel(state.profile.xp);
  const challenge = todaysChallenge();
  const entry = state.dailyEntries[challenge.id];
  const dailyVariant = getVariant(challenge.moduleId, challenge.variantId);
  const streak = state.profile.streak;
  const streakLive = streak.lastPlayedDate === toDateKey() ? streak.current : streak.current;

  const page = el('div', { class: 'page' });

  /* Identity + progression */
  page.appendChild(
    el('section', { class: 'ident' }, [
      el('div', { class: 'ident-main' }, [
        el('h1', { class: 'wordmark', text: 'MindCode' }),
        el('p', { class: 'rank', text: t(level.titleKey) }),
      ]),
      el('div', { class: `streak ${streakLive > 0 ? 'on' : ''}` }, [
        el('span', { class: 'streak-n', text: streakLive > 0 ? `🔥 ${streakLive}` : '—' }),
        el('span', { class: 'streak-l', text: t('common.streak') }),
      ]),
    ]),
  );

  page.appendChild(
    el('section', { class: 'xp' }, [
      progressBar(level.ratio, t('a11y.levelProgress', { level: level.level })),
      el('p', {
        class: 'xp-note',
        text: level.isMaxLevel
          ? t('home.maxLevel', { xp: state.profile.xp })
          : t('home.xpToNextLevel', {
              into: level.xpIntoLevel,
              span: level.xpForNextLevel,
              level: level.level + 1,
            }),
      }),
    ]),
  );

  /* Daily Challenge */
  const dailyCard = el('section', { class: `card daily ${entry ? '' : 'highlight'}` }, [
    el('p', { class: 'overline accent', text: t('home.dailyChallenge') }),
    el('h2', { class: 'card-title', text: t(dailyVariant.titleKey) }),
    el('p', {
      class: 'muted',
      text: entry
        ? entry.status === 'won'
          ? t('home.dailySolved', { count: entry.movesUsed, score: entry.score })
          : t('home.dailySpent')
        : t('home.dailyIntro'),
    }),
  ]);

  if (entry) {
    const countdown = el('p', { class: 'countdown', text: formatCountdown(msUntilNextUtcDay()) });
    dailyCard.appendChild(
      el('div', { class: 'next' }, [
        el('span', { class: 'faint small', text: t('home.nextChallenge') }),
        countdown,
      ]),
    );
    // Ticks while the player is looking at it — the one live element on the page.
    const timer = window.setInterval(() => {
      if (!countdown.isConnected) {
        window.clearInterval(timer);
        return;
      }
      countdown.textContent = formatCountdown(msUntilNextUtcDay());
    }, 1000);
  } else {
    const play = el('button', { class: 'btn primary', type: 'button' }, [`▶  ${t('home.play')}`]);
    play.addEventListener('click', () => {
      go({
        name: 'game',
        session: new GameSession({
          sessionId: `local_${challenge.id}`,
          moduleId: challenge.moduleId,
          variantId: challenge.variantId,
          mode: 'daily',
          seed: challenge.seed,
          challengeId: challenge.id,
        }),
      });
    });
    dailyCard.appendChild(play);
  }
  page.appendChild(dailyCard);

  /* Free play — driven by the registry, so a new module appears with no edit */
  for (const module of listLiveGameModules()) {
    page.appendChild(
      el('div', { class: 'group-head' }, [
        el('p', { class: 'overline', text: `${module.icon}  ${t(module.titleKey)}` }),
        el('p', { class: 'faint small', text: t(module.taglineKey) }),
      ]),
    );

    for (const variant of module.variants) {
      const locked = variant.unlocksAtLevel > level.level;
      const row = el('div', { class: `card row ${locked ? 'locked' : ''}` }, [
        el('div', { class: 'row-main' }, [
          el('span', { class: 'row-title', text: t(variant.titleKey) }),
          el('span', {
            class: 'faint small',
            text: locked
              ? t('home.unlocksAtLevel', { level: variant.unlocksAtLevel })
              : t(variant.subtitleKey),
          }),
        ]),
        el('span', { class: 'stars', text: locked ? '🔒' : '★'.repeat(variant.difficulty) }),
      ]);

      if (!locked) {
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');
        row.setAttribute(
          'aria-label',
          t('home.playVariant', { module: t(module.titleKey), variant: t(variant.titleKey) }),
        );
        const start = () => {
          go({
            name: 'game',
            session: new GameSession({
              sessionId: `local_${module.id}_${variant.id}_${Date.now()}`,
              moduleId: module.id,
              variantId: variant.id,
              mode: 'classic',
              seed: buildSeed('classic', 'local', module.id, variant.id, Date.now()),
            }),
          });
        };
        row.addEventListener('click', start);
        row.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            start();
          }
        });
      }
      page.appendChild(row);
    }
  }

  /* Statistics */
  const stats = state.profile.stats;
  if (stats.played > 0) {
    page.appendChild(el('p', { class: 'overline spaced', text: t('profile.statistics') }));
    page.appendChild(
      el('div', { class: 'stats' }, [
        statTile(t('profile.gamesPlayed'), `${stats.played}`, t('profile.gamesSolved', { count: stats.won })),
        statTile(t('profile.bestScore'), `${stats.bestScore}`),
        statTile(t('profile.currentStreak'), streakLive > 0 ? `${streakLive} 🔥` : '0', t('profile.longestStreak', { count: streak.longest })),
        statTile(t('profile.dailyChallenges'), `${stats.dailyCompleted}`),
      ]),
    );
  }

  /* Footer controls */
  const howTo = el('button', { class: 'btn ghost', type: 'button' }, [t('home.howToPlay')]);
  howTo.addEventListener('click', () => go({ name: 'howto' }));

  const langRow = el('div', { class: 'langs' }, [
    el('span', { class: 'faint small', text: `${t('settings.language')}:` }),
  ]);
  for (const option of ['system', ...SUPPORTED_LOCALES] as const) {
    const selected = state.locale === option;
    const chip = el(
      'button',
      { class: `chip ${selected ? 'on' : ''}`, type: 'button', 'aria-pressed': selected },
      [option === 'system' ? t('settings.languageSystem') : LOCALE_NAMES[option]],
    );
    chip.addEventListener('click', () => {
      state.locale = option;
      save(state);
      setLocale(activeLocale());
      render();
    });
    langRow.appendChild(chip);
  }

  page.appendChild(el('footer', { class: 'home-footer' }, [howTo, langRow]));
  return page;
}

/* ------------------------------------------------------------------ *
 * Game host — picks a board by the module's declared renderer
 * ------------------------------------------------------------------ */

function renderGame(session: GameSession): HTMLElement {
  const module = session.module;
  const variant = getVariant(module.id, session.variantId);

  const page = el('div', { class: 'page game' });
  page.appendChild(
    topBar(
      session.mode === 'daily' ? t('home.dailyChallenge') : t(module.titleKey),
      () => {
        if (!session.isOver) session.abandon();
        finish(session);
      },
    ),
  );
  page.appendChild(el('p', { class: 'faint small center', text: t(variant.titleKey) }));

  page.appendChild(
    module.renderer === 'memory-grid' ? memoryGridBoard(session) : numberPadBoard(session),
  );
  return page;
}

/* ---------- Number Logic board ---------- */

function numberPadBoard(session: GameSession): HTMLElement {
  const gameState = session.getState<NumberLogicState>();
  const { config } = gameState;
  const policy = getFeedbackPolicy(config.policyId);

  let entry = '';
  let error: { key: TranslationKey; params?: TranslationParams } | null = null;

  const board = el('div', { class: 'board' });
  const slotRow = el('div', { class: 'slots' });
  const status = el('p', { class: 'status' });
  const history = el('div', { class: 'history' });
  const pad = el('div', { class: 'pad' });

  const paint = () => {
    /* Slots */
    clear(slotRow);
    const solved = session.status === 'won';
    slotRow.setAttribute(
      'aria-label',
      entry.length === 0
        ? t('a11y.emptyCode', { digits: config.digits })
        : t('a11y.enteredCode', { digits: entry.split('').join(' ') }),
    );
    for (let i = 0; i < config.digits; i += 1) {
      const digit = entry[i];
      slotRow.appendChild(
        el('div', { class: `slot ${digit ? 'filled' : ''} ${solved ? 'solved' : ''}` }, [digit ?? '']),
      );
    }

    /* Status line */
    const left = Math.max(0, config.maxAttempts - session.getState<NumberLogicState>().attempts.length);
    status.className = `status ${error ? 'bad' : ''}`;
    status.textContent = error
      ? t(error.key, error.params)
      : t('numberLogic.guessesLeft', { count: left, policy: t(policy.labelKey) });

    /* History, newest first */
    clear(history);
    const attempts = session.getState<NumberLogicState>().attempts;
    if (attempts.length === 0) {
      history.appendChild(
        el('p', { class: 'faint small center hint', text: t('numberLogic.emptyHint', { digits: config.digits }) }),
      );
    } else {
      [...attempts].reverse().forEach((attempt, reverseIndex) => {
        const index = attempts.length - 1 - reverseIndex;
        const tone = attempt.score > 0 ? 'pos' : attempt.score < 0 ? 'neg' : 'zero';
        history.appendChild(
          el(
            'div',
            {
              class: 'guess',
              'aria-label': t('a11y.guessRow', {
                index: index + 1,
                guess: attempt.guess.split('').join(' '),
                result: policy.format(attempt.score),
              }),
            },
            [
              el('span', { class: 'guess-i', text: `${index + 1}` }),
              el('span', { class: 'guess-code', text: attempt.guess }),
              attempt.candidatesRemaining !== null
                ? el('span', {
                    class: 'guess-left',
                    text: t('numberLogic.candidatesLeft', { count: attempt.candidatesRemaining }),
                  })
                : null,
              el('span', { class: `pill ${tone}`, text: policy.format(attempt.score) }),
            ],
          ),
        );
      });
    }

    /* Keypad — eliminated digits dim as a memory aid, but stay tappable */
    clear(pad);
    const eliminated = eliminatedDigits(config, session.getState<NumberLogicState>().attempts);
    const keys: (string | 'del' | 'ok')[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
    for (const key of keys) {
      const isOk = key === 'ok';
      const isDel = key === 'del';
      const label = isOk ? t('numberLogic.check') : isDel ? '⌫' : key;
      const disabled =
        session.isOver ||
        (isOk && entry.length !== config.digits) ||
        (isDel && entry.length === 0);

      const button = el(
        'button',
        {
          class: `key ${isOk ? 'ok' : ''} ${isDel ? 'del' : ''} ${!isOk && !isDel && eliminated.has(key) ? 'dim' : ''}`,
          type: 'button',
          'aria-label': label,
          disabled,
        },
        [label],
      );

      button.addEventListener('click', () => {
        buzz(8);
        if (isOk) submit();
        else if (isDel) {
          entry = entry.slice(0, -1);
          paint();
        } else if (entry.length < config.digits) {
          entry += key;
          error = null;
          paint();
        }
      });
      pad.appendChild(button);
    }
  };

  const submit = () => {
    const outcome = session.submit({ guess: entry });

    if (!outcome.accepted) {
      error = {
        key: outcome.validation.messageKey ?? 'numberLogic.errorRejected',
        ...(outcome.validation.messageParams ? { params: outcome.validation.messageParams } : {}),
      };
      buzz([40, 60, 40]);
      slotRow.classList.remove('shake');
      void slotRow.offsetWidth; // restart the animation
      slotRow.classList.add('shake');
      paint();
      return;
    }

    entry = '';
    error = null;
    const feedback = outcome.feedback as NumberLogicFeedback | undefined;
    if (feedback?.solved) buzz([20, 40, 20, 40, 60]);
    paint();

    if (outcome.terminal) window.setTimeout(() => finish(session), 620);
  };

  /* Hardware keyboard, for anyone opening this on a laptop */
  const onKey = (event: KeyboardEvent) => {
    if (screen.name !== 'game') {
      window.removeEventListener('keydown', onKey);
      return;
    }
    if (/^[0-9]$/.test(event.key) && entry.length < config.digits) {
      entry += event.key;
      error = null;
      paint();
    } else if (event.key === 'Backspace') {
      entry = entry.slice(0, -1);
      paint();
    } else if (event.key === 'Enter' && entry.length === config.digits) {
      submit();
    }
  };
  window.addEventListener('keydown', onKey);

  board.append(slotRow, status, history, pad);
  paint();
  return board;
}

/* ---------- Memory Grid board ---------- */

function memoryGridBoard(session: GameSession): HTMLElement {
  const gameState = session.getState<MemoryGridState>();
  const { config, sequence } = gameState;

  let phase: 'watch' | 'recall' | 'done' = 'watch';
  const timers: number[] = [];

  const board = el('div', { class: 'board memory' });
  const heading = el('h2', { class: 'phase' });
  const hint = el('p', { class: 'status' });
  const bar = el('div', { class: 'bar-wrap' });
  const grid = el('div', { class: 'grid', style: `--size:${config.size}` });

  const paintHeader = () => {
    heading.textContent =
      phase === 'watch' ? t('memoryGrid.watch') : phase === 'recall' ? t('memoryGrid.recall') : t('memoryGrid.done');

    const current = session.getState<MemoryGridState>();
    const mistakesLeft = Math.max(0, config.maxMistakes - current.mistakes);
    hint.textContent =
      phase === 'watch'
        ? t('memoryGrid.watchHint', { count: config.sequenceLength })
        : t('memoryGrid.progress', {
            count: mistakesLeft,
            recalled: current.entered.length,
            total: config.sequenceLength,
          });

    clear(bar);
    bar.appendChild(progressBar(current.entered.length / config.sequenceLength));
  };

  const tiles: HTMLButtonElement[] = [];
  for (let tile = 0; tile < config.size * config.size; tile += 1) {
    const button = el('button', {
      class: 'tile',
      type: 'button',
      'aria-label': t('memoryGrid.tile', { number: tile + 1 }),
      disabled: true,
    }) as HTMLButtonElement;

    button.addEventListener('click', () => {
      if (phase !== 'recall') return;
      buzz(8);

      const outcome = session.submit({ tile });
      if (!outcome.accepted) return;

      const feedback = outcome.feedback as MemoryGridFeedback;
      button.classList.add(feedback.correct ? 'right' : 'wrong');
      timers.push(window.setTimeout(() => button.classList.remove('right', 'wrong'), 260));
      if (!feedback.correct) buzz([40, 60, 40]);
      paintHeader();

      if (outcome.terminal) {
        phase = 'done';
        tiles.forEach((other) => (other.disabled = true));
        paintHeader();
        timers.push(window.setTimeout(() => finish(session), 700));
      }
    });

    tiles.push(button);
    grid.appendChild(button);
  }

  /* Play the sequence, then hand control over. The reveal is presentation, not
     a rule, which is why it lives here and not in the engine. */
  let cursor = 500;
  for (const tile of sequence) {
    const at = cursor;
    timers.push(window.setTimeout(() => tiles[tile]?.classList.add('lit'), at));
    timers.push(window.setTimeout(() => tiles[tile]?.classList.remove('lit'), at + config.revealMs));
    cursor += config.revealMs + 220;
  }
  timers.push(
    window.setTimeout(() => {
      phase = 'recall';
      tiles.forEach((tile) => (tile.disabled = false));
      paintHeader();
    }, cursor),
  );

  // Leaving mid-sequence must not keep firing timers into a dead tree.
  const observer = new MutationObserver(() => {
    if (!board.isConnected) {
      timers.forEach(window.clearTimeout);
      observer.disconnect();
    }
  });
  observer.observe(root, { childList: true, subtree: true });

  board.append(heading, hint, bar, grid);
  paintHeader();
  return board;
}

/* ------------------------------------------------------------------ *
 * Result
 * ------------------------------------------------------------------ */

function renderResult(result: GameResult, score: ScoreBreakdown, events: ProgressEvent[]): HTMLElement {
  const won = result.outcome.status === 'won';
  const rating = RATING_KEYS[score.rating];
  const variant = getVariant(result.moduleId, result.variantId);

  const page = el('div', { class: 'page result' });

  page.appendChild(
    el('section', { class: 'verdict' }, [
      el('span', { class: 'glyph', text: won ? '✓' : '·' }),
      el('h2', { class: 'verdict-title', text: t(rating.title) }),
      el('p', { class: 'muted', text: t(rating.subtitle) }),
    ]),
  );

  page.appendChild(
    el('section', { class: 'card reveal' }, [
      el('p', { class: 'overline', text: t('result.codeWas') }),
      el('p', { class: `solution ${won ? 'won' : ''}`, text: result.solution }),
    ]),
  );

  page.appendChild(
    el('div', { class: 'stats' }, [
      statTile(t('result.score'), `${score.total}`),
      statTile(t('result.xpEarned'), `+${score.xp}`),
      statTile(
        t('result.guesses'),
        won ? `${result.outcome.movesUsed}/${result.outcome.maxMoves}` : `X/${result.outcome.maxMoves}`,
      ),
      statTile(t('result.time'), formatDuration(result.outcome.durationMs)),
    ]),
  );

  if (score.components.length > 0) {
    const breakdown = el('section', { class: 'card' }, [
      el('p', { class: 'overline', text: t('result.howItScored') }),
    ]);
    for (const component of score.components) {
      breakdown.appendChild(
        el('div', { class: 'line' }, [
          el('div', { class: 'line-main' }, [
            el('span', { text: t(component.labelKey) }),
            component.detailKey
              ? el('span', { class: 'faint small', text: t(component.detailKey, component.detailParams) })
              : null,
          ]),
          el('span', {
            class: `line-pts ${component.points >= 0 ? 'pos' : 'neg'}`,
            text:
              component.kind === 'multiply'
                ? `×${component.value}`
                : `${component.points >= 0 ? '+' : ''}${component.points}`,
          }),
        ]),
      );
    }
    page.appendChild(breakdown);
  }

  if (score.isPersonalBest) {
    page.appendChild(
      el('section', { class: 'card highlight' }, [
        el('p', { class: 'card-lead accent', text: t('result.personalBest') }),
        el('p', { class: 'faint small', text: t('result.personalBestBody', { variant: t(variant.titleKey) }) }),
      ]),
    );
  }

  for (const event of events) {
    if (event.type === 'level_up') {
      page.appendChild(
        el('section', { class: 'card highlight' }, [
          el('p', { class: 'card-lead accent', text: t('result.levelUp', { level: event.to, title: t(event.titleKey) }) }),
          el('p', { class: 'faint small', text: t('result.levelUpBody') }),
        ]),
      );
    } else if (event.type === 'streak_extended' || event.type === 'streak_started') {
      page.appendChild(
        el('section', { class: 'card' }, [
          el('p', { class: 'card-lead', text: t('result.streak', { count: event.current }) }),
          el('p', { class: 'faint small', text: t('result.streakBody') }),
        ]),
      );
    } else if (event.type === 'badge_unlocked') {
      const badge = getBadge(event.badgeId);
      page.appendChild(
        el('section', { class: 'card' }, [
          el('p', { class: 'card-lead', text: `${badge?.icon ?? '🏆'}  ${t(event.titleKey)}` }),
          el('p', { class: 'faint small', text: t(event.descriptionKey) }),
        ]),
      );
    }
  }

  page.appendChild(el('p', { class: 'faint small center note', text: t('result.notSynced') }));

  const done = el('button', { class: 'btn primary', type: 'button' }, [t('common.done')]);
  done.addEventListener('click', () => go({ name: 'home' }));
  page.appendChild(el('footer', { class: 'result-footer' }, [done]));
  return page;
}

/* ------------------------------------------------------------------ *
 * How to play
 * ------------------------------------------------------------------ */

function renderHowTo(): HTMLElement {
  const policy = getFeedbackPolicy('plus-minus');
  const page = el('div', { class: 'page' });

  page.appendChild(topBar(t('howToPlay.title'), () => go({ name: 'home' })));
  page.appendChild(el('p', { class: 'muted', text: t('howToPlay.intro') }));

  const rules = el('section', { class: 'card' }, [
    el('p', { class: 'overline', text: t('howToPlay.scoringTitle', { policy: t(policy.labelKey) }) }),
  ]);
  const legend: [string, string, TranslationKey][] = [
    ['+1', 'pos', policy.legend.exact],
    ['−1', 'neg', policy.legend.misplaced],
    ['0', 'zero', policy.legend.absent],
  ];
  for (const [symbol, tone, key] of legend) {
    rules.appendChild(
      el('div', { class: 'rule' }, [
        el('span', { class: `pill ${tone}`, text: symbol }),
        el('span', { text: t(key) }),
      ]),
    );
  }
  rules.appendChild(el('p', { class: 'faint small', text: t('howToPlay.ambiguity') }));
  page.appendChild(rules);

  page.appendChild(el('p', { class: 'overline spaced', text: t('howToPlay.exampleTitle') }));
  const example: [string, string, string, TranslationKey][] = [
    ['56', '0', 'zero', 'howToPlay.example1'],
    ['28', '−2', 'neg', 'howToPlay.example2'],
    ['82', '+2', 'pos', 'howToPlay.example3'],
  ];
  for (const [guess, display, tone, note] of example) {
    page.appendChild(
      el('div', { class: 'example' }, [
        el('div', { class: 'guess' }, [
          el('span', { class: 'guess-code', text: guess }),
          el('span', { class: `pill ${tone}`, text: display }),
        ]),
        el('p', { class: 'faint small', text: t(note) }),
      ]),
    );
  }

  page.appendChild(
    el('section', { class: 'card spaced' }, [
      el('p', { class: 'card-lead', text: t('howToPlay.dailyTitle') }),
      el('p', { class: 'faint small', text: t('howToPlay.dailyBody') }),
    ]),
  );
  page.appendChild(
    el('section', { class: 'card' }, [
      el('p', { class: 'card-lead', text: t('howToPlay.memoryTitle') }),
      el('p', { class: 'faint small', text: t('howToPlay.memoryBody') }),
    ]),
  );

  const back = el('button', { class: 'btn ghost', type: 'button' }, [t('common.done')]);
  back.addEventListener('click', () => go({ name: 'home' }));
  page.appendChild(back);
  return page;
}

/* ------------------------------------------------------------------ *
 * Render loop
 * ------------------------------------------------------------------ */

function render(): void {
  clear(root);
  document.documentElement.lang = activeLocale();

  if (screen.name === 'home') root.appendChild(renderHome());
  else if (screen.name === 'game') root.appendChild(renderGame(screen.session));
  else if (screen.name === 'result') root.appendChild(renderResult(screen.result, screen.score, screen.events));
  else root.appendChild(renderHowTo());
}

render();
