import type { GameResult } from '@/engine/session';
import type { TranslationKey } from '@/i18n/types';

/**
 * Scoring is deliberately separated from game rules.
 *
 * A `GameEngine` decides *what happened* (won in 4 moves, 0.82 accuracy, 31s).
 * The scoring engine decides *what that is worth*, by running an ordered list of
 * `ScoringRule`s over a normalised `ScoringContext`. Rules are data, not code
 * paths: tuning the economy, running an A/B test, or scoring a brand-new game
 * type is a matter of composing a different rule list.
 */

export interface ScoringPlayerContext {
  level: number;
  /** Daily streak *before* this result is applied. */
  currentStreak: number;
  /** Best total the player has previously scored on this variant, if any. */
  personalBest: number | null;
}

export interface ScoringContext {
  result: GameResult;
  module: {
    id: string;
    basePoints: number;
    difficultyStep: number;
  };
  player: ScoringPlayerContext;
}

export type ScoreComponentKind = 'add' | 'multiply';

export interface ScoreComponent {
  id: string;
  /**
   * Translation key for the component's name.
   *
   * Rules emit keys rather than prose because this layer is compiled into the
   * Cloud Functions too — a backend has no business deciding what language a
   * player reads, and a score breakdown persisted as English would be wrong for
   * everyone else the moment a second locale ships.
   */
  labelKey: TranslationKey;
  kind: ScoreComponentKind;
  /** Points added, or the factor multiplied by. */
  value: number;
  /** Signed effect on the running total, filled in by the engine. */
  points: number;
  /** Optional one-line explanation shown on the result screen. */
  detailKey?: TranslationKey;
  detailParams?: Record<string, string | number>;
}

export interface ScoringRule {
  id: string;
  /**
   * Developer-facing name, for debugging and for reading a profile definition.
   * Never rendered — what the player sees is the `labelKey` on the component
   * the rule emits.
   */
  name: string;
  /** Skip the rule entirely when this returns false. */
  applies(ctx: ScoringContext): boolean;
  /**
   * Return the component(s) this rule contributes. `running` is the score so
   * far, which multiplier-style rules need.
   */
  evaluate(
    ctx: ScoringContext,
    running: number,
  ): Omit<ScoreComponent, 'points'> | Omit<ScoreComponent, 'points'>[] | null;
}

export type ScoreRating = 'flawless' | 'excellent' | 'solid' | 'scraped' | 'failed';

export interface ScoreBreakdown {
  /** Final game score, never negative. */
  total: number;
  /** Experience points awarded to the profile. */
  xp: number;
  rating: ScoreRating;
  components: ScoreComponent[];
  /** True when `total` beats the stored personal best for this variant. */
  isPersonalBest: boolean;
}

/** A named, ordered rule list. Modules pick one; experiments can swap them. */
export interface ScoringProfile {
  id: string;
  rules: ScoringRule[];
  /** total × xpRate = XP, before mode weighting. */
  xpRate: number;
  /** XP multiplier per mode, e.g. daily challenges are worth more. */
  modeWeights: Record<string, number>;
}
