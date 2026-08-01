import type { GameModule, GameVariant } from '@/engine/types';
import { recallScoringProfile } from '@/scoring/profiles';
import { memoryGridEngine } from './engine';
import type { MemoryGridConfig } from './generator';

/**
 * Variant ladder.
 *
 * Sequence length is the difficulty dial; grid size only widens it at the top,
 * because a 4×4 grid with a short sequence is easier than a 3×3 with a long one
 * — more tiles means less interference between them.
 */
const variants: GameVariant<MemoryGridConfig>[] = [
  {
    id: 'short',
    titleKey: 'variants.memoryShort',
    subtitleKey: 'variants.memoryShortSubtitle',
    difficulty: 1,
    unlocksAtLevel: 0,
    config: { size: 3, sequenceLength: 4, maxMistakes: 2, revealMs: 620 },
  },
  {
    id: 'standard',
    titleKey: 'variants.memoryStandard',
    subtitleKey: 'variants.memoryStandardSubtitle',
    difficulty: 3,
    unlocksAtLevel: 0,
    config: { size: 3, sequenceLength: 6, maxMistakes: 2, revealMs: 560 },
  },
  {
    id: 'long',
    titleKey: 'variants.memoryLong',
    subtitleKey: 'variants.memoryLongSubtitle',
    difficulty: 5,
    unlocksAtLevel: 5,
    config: { size: 4, sequenceLength: 9, maxMistakes: 3, revealMs: 500 },
  },
];

export const memoryGridModule: GameModule<
  ReturnType<typeof memoryGridEngine.createInitialState>,
  { tile: number },
  unknown,
  MemoryGridConfig
> = {
  id: 'memory-grid',
  titleKey: 'modules.memoryGrid',
  taglineKey: 'modules.memoryGridTagline',
  category: 'memory',
  icon: '🧠',
  status: 'live',
  engine: memoryGridEngine,
  variants,
  // Not in the Daily Challenge yet: the daily rotation is single-module in v1
  // (see DEFAULT_MODULE_ID). Cross-module rotation is a roadmap item, and this
  // field is already what it will read.
  dailyVariantPool: [],
  renderer: 'memory-grid',
  scoringProfileId: recallScoringProfile.id,
  scoring: {
    basePoints: 110,
    difficultyStep: 0.4,
  },
};
