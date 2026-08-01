import type { GameResult } from '@/engine/session';
import type { ScoreBreakdown } from '@/scoring/types';
import type { UserProfile } from './types';

/**
 * Badge catalogue.
 *
 * A badge is a pure predicate over the profile *after* a result has been folded
 * in, plus the result itself. Keeping them declarative means new badges are a
 * data change — including badges for game modules that do not exist yet, since
 * predicates can key off `result.moduleId`.
 */

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface BadgeContext {
  /** Profile with this game's stats, XP and streak already applied. */
  profile: UserProfile;
  result: GameResult;
  score: ScoreBreakdown;
  /** Player's local hour (0–23) when the game finished. */
  localHour: number;
}

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  /** Hidden badges are shown as "???" until unlocked. */
  secret?: boolean;
  check(ctx: BadgeContext): boolean;
}

export const BADGES: BadgeDefinition[] = [
  {
    id: 'first_light',
    title: 'First Light',
    description: 'Complete your first game.',
    icon: '🌱',
    tier: 'bronze',
    check: ({ profile }) => profile.stats.played >= 1,
  },
  {
    id: 'clean_read',
    title: 'Clean Read',
    description: 'Solve a code on your very first guess.',
    icon: '🎯',
    tier: 'gold',
    check: ({ result }) => result.outcome.status === 'won' && result.outcome.movesUsed === 1,
  },
  {
    id: 'efficient_mind',
    title: 'Efficient Mind',
    description: 'Win using no more than half of your guesses.',
    icon: '⚡',
    tier: 'silver',
    check: ({ result }) =>
      result.outcome.status === 'won' &&
      result.outcome.movesUsed <= Math.floor(result.outcome.maxMoves / 2),
  },
  {
    id: 'deep_end',
    title: 'The Deep End',
    description: 'Solve a three-digit code.',
    icon: '🧩',
    tier: 'silver',
    check: ({ result }) =>
      result.outcome.status === 'won' && result.variantId === 'three-digit',
  },
  {
    id: 'four_dimensional',
    title: 'Four Dimensional',
    description: 'Solve a four-digit code.',
    icon: '🔷',
    tier: 'gold',
    check: ({ result }) => result.outcome.status === 'won' && result.variantId === 'four-digit',
  },
  {
    id: 'total_recall',
    title: 'Total Recall',
    description: 'Rebuild a memory sequence without a single mistake.',
    icon: '🧠',
    tier: 'gold',
    // Keyed off moduleId and an engine metric — the pattern that lets badges
    // exist for games the progress engine knows nothing about.
    check: ({ result }) =>
      result.moduleId === 'memory-grid' &&
      result.outcome.status === 'won' &&
      result.outcome.metrics.mistakes === 0,
  },
  {
    id: 'polymath',
    title: 'Polymath',
    description: 'Win a game in two different training modules.',
    icon: '🎓',
    tier: 'silver',
    check: ({ profile }) =>
      Object.values(profile.modules).filter((module) => module.won > 0).length >= 2,
  },
  {
    id: 'streak_3',
    title: 'Warming Up',
    description: 'Play three days in a row.',
    icon: '🔥',
    tier: 'bronze',
    check: ({ profile }) => profile.streak.current >= 3,
  },
  {
    id: 'streak_7',
    title: 'Seven Straight',
    description: 'Keep a seven-day streak.',
    icon: '🔥',
    tier: 'silver',
    check: ({ profile }) => profile.streak.current >= 7,
  },
  {
    id: 'streak_30',
    title: 'Unbroken',
    description: 'Keep a thirty-day streak.',
    icon: '💎',
    tier: 'platinum',
    check: ({ profile }) => profile.streak.current >= 30,
  },
  {
    id: 'daily_10',
    title: 'Regular',
    description: 'Complete ten Daily Challenges.',
    icon: '📅',
    tier: 'bronze',
    check: ({ profile }) => profile.stats.dailyCompleted >= 10,
  },
  {
    id: 'daily_100',
    title: 'Devoted',
    description: 'Complete one hundred Daily Challenges.',
    icon: '🏛️',
    tier: 'platinum',
    check: ({ profile }) => profile.stats.dailyCompleted >= 100,
  },
  {
    id: 'centurion',
    title: 'Centurion',
    description: 'Play one hundred games.',
    icon: '💯',
    tier: 'gold',
    check: ({ profile }) => profile.stats.played >= 100,
  },
  {
    id: 'level_10',
    title: 'Logic Explorer',
    description: 'Reach level 10.',
    icon: '🧭',
    tier: 'silver',
    check: ({ profile }) => profile.level >= 10,
  },
  {
    id: 'level_25',
    title: 'Cipher Adept',
    description: 'Reach level 25.',
    icon: '🗝️',
    tier: 'gold',
    check: ({ profile }) => profile.level >= 25,
  },
  {
    id: 'level_50',
    title: 'Mind Master',
    description: 'Reach level 50.',
    icon: '👑',
    tier: 'platinum',
    check: ({ profile }) => profile.level >= 50,
  },
  {
    id: 'quick_thinker',
    title: 'Quick Thinker',
    description: 'Solve a code in under twenty seconds.',
    icon: '⏱️',
    tier: 'silver',
    check: ({ result }) =>
      result.outcome.status === 'won' && result.outcome.durationMs < 20_000,
  },
  {
    id: 'win_run_10',
    title: 'On A Roll',
    description: 'Win ten games in a row.',
    icon: '🎲',
    tier: 'gold',
    check: ({ profile }) => profile.stats.currentWinRun >= 10,
  },
  {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Finish a game between midnight and 5am.',
    icon: '🦉',
    tier: 'bronze',
    secret: true,
    check: ({ localHour }) => localHour >= 0 && localHour < 5,
  },
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Finish a game before 7am.',
    icon: '🌅',
    tier: 'bronze',
    secret: true,
    check: ({ localHour }) => localHour >= 5 && localHour < 7,
  },
  {
    id: 'comeback',
    title: 'Comeback',
    description: 'Win a game right after losing one.',
    icon: '↩️',
    tier: 'bronze',
    secret: true,
    check: ({ profile, result }) =>
      result.outcome.status === 'won' && profile.stats.currentWinRun === 1 && profile.stats.played > 1,
  },
];

const badgeIndex = new Map(BADGES.map((b) => [b.id, b]));

export function getBadge(id: string): BadgeDefinition | undefined {
  return badgeIndex.get(id);
}

/** Badge ids newly satisfied by `ctx` that the profile does not already hold. */
export function evaluateBadges(ctx: BadgeContext): BadgeDefinition[] {
  return BADGES.filter((badge) => !ctx.profile.badges[badge.id] && safeCheck(badge, ctx));
}

function safeCheck(badge: BadgeDefinition, ctx: BadgeContext): boolean {
  try {
    return badge.check(ctx);
  } catch {
    // A misbehaving badge predicate must never break a game submission.
    return false;
  }
}
