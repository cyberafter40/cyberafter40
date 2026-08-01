import type { GameModule, GameVariant } from '@/engine/types';
import { standardScoringProfile } from '@/scoring/profiles';
import { numberLogicEngine } from './engine';
import type { NumberLogicConfig } from './generator';
import { plusMinusPolicy } from './policies';

/**
 * Variant ladder.
 *
 * Codes use unique digits in v1 — repeats are legal in the engine but make the
 * net ±score noticeably harder to reason about, so they are held back for an
 * "Expert" variant once players have the basic loop.
 */
const variants: GameVariant<NumberLogicConfig>[] = [
  {
    id: 'two-digit',
    titleKey: 'variants.twoDigit',
    subtitleKey: 'variants.twoDigitSubtitle',
    difficulty: 1,
    unlocksAtLevel: 0,
    config: {
      digits: 2,
      maxAttempts: 6,
      allowRepeatedDigits: false,
      allowLeadingZero: true,
      policyId: plusMinusPolicy.id,
    },
  },
  {
    id: 'three-digit',
    titleKey: 'variants.threeDigit',
    subtitleKey: 'variants.threeDigitSubtitle',
    difficulty: 3,
    unlocksAtLevel: 0,
    config: {
      digits: 3,
      maxAttempts: 8,
      allowRepeatedDigits: false,
      allowLeadingZero: true,
      policyId: plusMinusPolicy.id,
    },
  },
  {
    id: 'four-digit',
    titleKey: 'variants.fourDigit',
    subtitleKey: 'variants.fourDigitSubtitle',
    difficulty: 5,
    unlocksAtLevel: 8,
    config: {
      digits: 4,
      maxAttempts: 10,
      allowRepeatedDigits: false,
      allowLeadingZero: true,
      policyId: plusMinusPolicy.id,
    },
  },
];

export const numberLogicModule: GameModule<
  ReturnType<typeof numberLogicEngine.createInitialState>,
  { guess: string },
  unknown,
  NumberLogicConfig
> = {
  id: 'number-logic',
  titleKey: 'modules.numberLogic',
  taglineKey: 'modules.numberLogicTagline',
  category: 'logic',
  icon: '🔢',
  status: 'live',
  engine: numberLogicEngine,
  variants,
  // The Daily Challenge alternates between the two core lengths so the ritual
  // stays varied without ever demanding a variant the player has not unlocked.
  dailyVariantPool: ['two-digit', 'three-digit'],
  renderer: 'number-pad',
  scoringProfileId: standardScoringProfile.id,
  scoring: {
    basePoints: 120,
    difficultyStep: 0.35,
  },
};
