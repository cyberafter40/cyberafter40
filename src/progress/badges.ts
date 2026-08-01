import type { GameResult } from '@/engine/session';
import type { TranslationKey } from '@/i18n/types';
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
  /** Translation key for the badge name, e.g. `badge.firstLight`. */
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: string;
  tier: BadgeTier;
  /** Hidden badges are shown as "???" until unlocked. */
  secret?: boolean;
  check(ctx: BadgeContext): boolean;
}

export const BADGES: BadgeDefinition[] = [
  {
    id: 'first_light',
    titleKey: 'badge.firstLight',
    descriptionKey: 'badge.firstLightBody',
    icon: '🌱',
    tier: 'bronze',
    check: ({ profile }) => profile.stats.played >= 1,
  },
  {
    id: 'clean_read',
    titleKey: 'badge.cleanRead',
    descriptionKey: 'badge.cleanReadBody',
    icon: '🎯',
    tier: 'gold',
    check: ({ result }) => result.outcome.status === 'won' && result.outcome.movesUsed === 1,
  },
  {
    id: 'efficient_mind',
    titleKey: 'badge.efficientMind',
    descriptionKey: 'badge.efficientMindBody',
    icon: '⚡',
    tier: 'silver',
    check: ({ result }) =>
      result.outcome.status === 'won' &&
      result.outcome.movesUsed <= Math.floor(result.outcome.maxMoves / 2),
  },
  {
    id: 'deep_end',
    titleKey: 'badge.deepEnd',
    descriptionKey: 'badge.deepEndBody',
    icon: '🧩',
    tier: 'silver',
    check: ({ result }) =>
      result.outcome.status === 'won' && result.variantId === 'three-digit',
  },
  {
    id: 'four_dimensional',
    titleKey: 'badge.fourDimensional',
    descriptionKey: 'badge.fourDimensionalBody',
    icon: '🔷',
    tier: 'gold',
    check: ({ result }) => result.outcome.status === 'won' && result.variantId === 'four-digit',
  },
  {
    id: 'total_recall',
    titleKey: 'badge.totalRecall',
    descriptionKey: 'badge.totalRecallBody',
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
    titleKey: 'badge.polymath',
    descriptionKey: 'badge.polymathBody',
    icon: '🎓',
    tier: 'silver',
    check: ({ profile }) =>
      Object.values(profile.modules).filter((module) => module.won > 0).length >= 2,
  },
  {
    id: 'streak_3',
    titleKey: 'badge.streak3',
    descriptionKey: 'badge.streak3Body',
    icon: '🔥',
    tier: 'bronze',
    check: ({ profile }) => profile.streak.current >= 3,
  },
  {
    id: 'streak_7',
    titleKey: 'badge.streak7',
    descriptionKey: 'badge.streak7Body',
    icon: '🔥',
    tier: 'silver',
    check: ({ profile }) => profile.streak.current >= 7,
  },
  {
    id: 'streak_30',
    titleKey: 'badge.streak30',
    descriptionKey: 'badge.streak30Body',
    icon: '💎',
    tier: 'platinum',
    check: ({ profile }) => profile.streak.current >= 30,
  },
  {
    id: 'daily_10',
    titleKey: 'badge.daily10',
    descriptionKey: 'badge.daily10Body',
    icon: '📅',
    tier: 'bronze',
    check: ({ profile }) => profile.stats.dailyCompleted >= 10,
  },
  {
    id: 'daily_100',
    titleKey: 'badge.daily100',
    descriptionKey: 'badge.daily100Body',
    icon: '🏛️',
    tier: 'platinum',
    check: ({ profile }) => profile.stats.dailyCompleted >= 100,
  },
  {
    id: 'centurion',
    titleKey: 'badge.centurion',
    descriptionKey: 'badge.centurionBody',
    icon: '💯',
    tier: 'gold',
    check: ({ profile }) => profile.stats.played >= 100,
  },
  {
    id: 'level_10',
    titleKey: 'badge.level10',
    descriptionKey: 'badge.level10Body',
    icon: '🧭',
    tier: 'silver',
    check: ({ profile }) => profile.level >= 10,
  },
  {
    id: 'level_25',
    titleKey: 'badge.level25',
    descriptionKey: 'badge.level25Body',
    icon: '🗝️',
    tier: 'gold',
    check: ({ profile }) => profile.level >= 25,
  },
  {
    id: 'level_50',
    titleKey: 'badge.level50',
    descriptionKey: 'badge.level50Body',
    icon: '👑',
    tier: 'platinum',
    check: ({ profile }) => profile.level >= 50,
  },
  {
    id: 'quick_thinker',
    titleKey: 'badge.quickThinker',
    descriptionKey: 'badge.quickThinkerBody',
    icon: '⏱️',
    tier: 'silver',
    check: ({ result }) =>
      result.outcome.status === 'won' && result.outcome.durationMs < 20_000,
  },
  {
    id: 'win_run_10',
    titleKey: 'badge.winRun10',
    descriptionKey: 'badge.winRun10Body',
    icon: '🎲',
    tier: 'gold',
    check: ({ profile }) => profile.stats.currentWinRun >= 10,
  },
  {
    id: 'night_owl',
    titleKey: 'badge.nightOwl',
    descriptionKey: 'badge.nightOwlBody',
    icon: '🦉',
    tier: 'bronze',
    secret: true,
    check: ({ localHour }) => localHour >= 0 && localHour < 5,
  },
  {
    id: 'early_bird',
    titleKey: 'badge.earlyBird',
    descriptionKey: 'badge.earlyBirdBody',
    icon: '🌅',
    tier: 'bronze',
    secret: true,
    check: ({ localHour }) => localHour >= 5 && localHour < 7,
  },
  {
    id: 'comeback',
    titleKey: 'badge.comeback',
    descriptionKey: 'badge.comebackBody',
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
