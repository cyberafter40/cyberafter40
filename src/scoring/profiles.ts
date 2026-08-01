import {
  baseCompletionRule,
  dailyChallengeRule,
  deductionRule,
  firstTryRule,
  moveEfficiencyRule,
  participationRule,
  streakRule,
  timeBonusRule,
} from './rules';
import type { ScoringProfile } from './types';

/**
 * Rule order is the economy. Additive rules build the raw score, then
 * multiplicative rules (mode, streak) scale the whole thing.
 */
export const standardScoringProfile: ScoringProfile = {
  id: 'standard.v1',
  rules: [
    baseCompletionRule,
    participationRule,
    moveEfficiencyRule,
    deductionRule,
    firstTryRule,
    timeBonusRule(90_000),
    dailyChallengeRule,
    streakRule(),
  ],
  xpRate: 0.5,
  modeWeights: {
    daily: 1.4,
    classic: 1,
    practice: 0.4,
  },
};

/**
 * Recall tasks (Memory Grid).
 *
 * The move-economy rules are deliberately absent. `moveEfficiencyRule` rewards
 * finishing under budget, but a perfect recall run uses *exactly* the tap
 * budget minus its mistake allowance — so efficiency would pay out for playing
 * badly, and `firstTryRule` could never fire at all. What matters instead is
 * precision, which `deductionRule` already reads out of the engine's
 * `accuracy` (correct taps ÷ total taps).
 *
 * Speed gets a small, forgiving bonus: recall should reward attention, not
 * panic.
 */
export const recallScoringProfile: ScoringProfile = {
  id: 'recall.v1',
  rules: [
    baseCompletionRule,
    participationRule,
    deductionRule,
    timeBonusRule(60_000, 50),
    dailyChallengeRule,
    streakRule(),
  ],
  xpRate: 0.5,
  modeWeights: { daily: 1.4, classic: 1, practice: 0.4 },
};

/**
 * Reaction-style modules will want speed to matter far more than anything else.
 * Registered here so the shape is proven before those modules land; see
 * docs/GAME_ENGINE_GUIDE.md.
 */
export const reflexScoringProfile: ScoringProfile = {
  id: 'reflex.v1',
  rules: [
    baseCompletionRule,
    participationRule,
    deductionRule,
    timeBonusRule(20_000, 200),
    dailyChallengeRule,
    streakRule(),
  ],
  xpRate: 0.5,
  modeWeights: { daily: 1.4, classic: 1, practice: 0.4 },
};

const profiles: Record<string, ScoringProfile> = {
  [standardScoringProfile.id]: standardScoringProfile,
  [recallScoringProfile.id]: recallScoringProfile,
  [reflexScoringProfile.id]: reflexScoringProfile,
};

export function getScoringProfile(id: string): ScoringProfile {
  const profile = profiles[id];
  if (!profile) throw new Error(`Unknown scoring profile "${id}"`);
  return profile;
}
