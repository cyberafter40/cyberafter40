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
 * Reaction- and memory-style modules will want speed to matter far more than
 * move economy. Registered here so the shape is proven before those modules
 * land; see docs/GAME_ENGINE_GUIDE.md.
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
  [reflexScoringProfile.id]: reflexScoringProfile,
};

export function getScoringProfile(id: string): ScoringProfile {
  const profile = profiles[id];
  if (!profile) throw new Error(`Unknown scoring profile "${id}"`);
  return profile;
}
