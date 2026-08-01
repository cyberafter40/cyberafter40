/**
 * XP curve and level titles.
 *
 * Design intent: a player doing one Daily Challenge a day should feel Level 10
 * ("Logic Explorer") within roughly a fortnight and Level 50 ("Mind Master")
 * after months of consistency — long enough to be an identity, short enough to
 * be believable.
 */

import type { TranslationKey } from '@/i18n/types';

export const MAX_LEVEL = 50;

/** Cumulative XP required to *reach* `level`. Level 1 costs nothing. */
export function totalXpForLevel(level: number): number {
  const clamped = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  if (clamped <= 1) return 0;
  return Math.round(60 * Math.pow(clamped - 1, 1.55));
}

export function levelForXp(xp: number): number {
  const safeXp = Math.max(0, xp);
  let level = 1;
  while (level < MAX_LEVEL && safeXp >= totalXpForLevel(level + 1)) {
    level += 1;
  }
  return level;
}

export interface LevelProgress {
  level: number;
  /** Translation key for the rank name, e.g. `rank.logicExplorer`. */
  titleKey: TranslationKey;
  /** XP earned inside the current level. */
  xpIntoLevel: number;
  /** XP the current level spans. 0 once MAX_LEVEL is reached. */
  xpForNextLevel: number;
  /** 0..1 fill for the progress bar. 1 at max level. */
  ratio: number;
  isMaxLevel: boolean;
}

export function describeLevel(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const isMaxLevel = level >= MAX_LEVEL;
  const floor = totalXpForLevel(level);
  const ceiling = isMaxLevel ? floor : totalXpForLevel(level + 1);
  const span = Math.max(1, ceiling - floor);

  return {
    level,
    titleKey: levelTitleKey(level),
    xpIntoLevel: Math.max(0, xp - floor),
    xpForNextLevel: isMaxLevel ? 0 : ceiling - floor,
    ratio: isMaxLevel ? 1 : Math.min(1, Math.max(0, (xp - floor) / span)),
    isMaxLevel,
  };
}

/** Ranks are inclusive-from `minLevel` up to the next entry. */
export interface LevelTitle {
  minLevel: number;
  titleKey: TranslationKey;
}

export const LEVEL_TITLES: LevelTitle[] = [
  { minLevel: 1, titleKey: 'rank.beginner' },
  { minLevel: 3, titleKey: 'rank.curiousMind' },
  { minLevel: 5, titleKey: 'rank.patternSeeker' },
  { minLevel: 8, titleKey: 'rank.deductor' },
  { minLevel: 10, titleKey: 'rank.logicExplorer' },
  { minLevel: 14, titleKey: 'rank.codebreaker' },
  { minLevel: 18, titleKey: 'rank.analyst' },
  { minLevel: 22, titleKey: 'rank.strategist' },
  { minLevel: 26, titleKey: 'rank.cipherAdept' },
  { minLevel: 30, titleKey: 'rank.mindArchitect' },
  { minLevel: 35, titleKey: 'rank.grandmaster' },
  { minLevel: 40, titleKey: 'rank.cognitiveElite' },
  { minLevel: 45, titleKey: 'rank.oracle' },
  { minLevel: 50, titleKey: 'rank.mindMaster' },
];

export function levelTitleKey(level: number): TranslationKey {
  let titleKey: TranslationKey = LEVEL_TITLES[0]?.titleKey ?? 'rank.beginner';
  for (const entry of LEVEL_TITLES) {
    if (level >= entry.minLevel) titleKey = entry.titleKey;
    else break;
  }
  return titleKey;
}

/** The next rank a player is working toward — shown on the profile screen. */
export function nextTitleMilestone(level: number): LevelTitle | null {
  return LEVEL_TITLES.find((entry) => entry.minLevel > level) ?? null;
}
