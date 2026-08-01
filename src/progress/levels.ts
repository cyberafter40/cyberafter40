/**
 * XP curve and level titles.
 *
 * Design intent: a player doing one Daily Challenge a day should feel Level 10
 * ("Logic Explorer") within roughly a fortnight and Level 50 ("Mind Master")
 * after months of consistency — long enough to be an identity, short enough to
 * be believable.
 */

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
  title: string;
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
    title: levelTitle(level),
    xpIntoLevel: Math.max(0, xp - floor),
    xpForNextLevel: isMaxLevel ? 0 : ceiling - floor,
    ratio: isMaxLevel ? 1 : Math.min(1, Math.max(0, (xp - floor) / span)),
    isMaxLevel,
  };
}

/** Ranks are inclusive-from `minLevel` up to the next entry. */
export const LEVEL_TITLES: { minLevel: number; title: string }[] = [
  { minLevel: 1, title: 'Beginner' },
  { minLevel: 3, title: 'Curious Mind' },
  { minLevel: 5, title: 'Pattern Seeker' },
  { minLevel: 8, title: 'Deductor' },
  { minLevel: 10, title: 'Logic Explorer' },
  { minLevel: 14, title: 'Codebreaker' },
  { minLevel: 18, title: 'Analyst' },
  { minLevel: 22, title: 'Strategist' },
  { minLevel: 26, title: 'Cipher Adept' },
  { minLevel: 30, title: 'Mind Architect' },
  { minLevel: 35, title: 'Grandmaster of Logic' },
  { minLevel: 40, title: 'Cognitive Elite' },
  { minLevel: 45, title: 'Oracle' },
  { minLevel: 50, title: 'Mind Master' },
];

export function levelTitle(level: number): string {
  let title = LEVEL_TITLES[0]?.title ?? 'Beginner';
  for (const entry of LEVEL_TITLES) {
    if (level >= entry.minLevel) title = entry.title;
    else break;
  }
  return title;
}

/** The next rank a player is working toward — shown on the profile screen. */
export function nextTitleMilestone(level: number): { minLevel: number; title: string } | null {
  return LEVEL_TITLES.find((entry) => entry.minLevel > level) ?? null;
}
