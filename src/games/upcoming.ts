import type { GameEngine, GameModule } from '@/engine/types';
import type { TranslationKey } from '@/i18n/types';
import { standardScoringProfile } from '@/scoring/profiles';

/**
 * Roadmap modules.
 *
 * These are real registry entries with real metadata — the home screen renders
 * them as locked cards from the same list that renders playable games — but
 * their engines are intentionally unimplemented. Registering them now is not
 * decoration: it proves the platform boundary. Adding memory or reaction games
 * later means replacing `notImplementedEngine` with a real `GameEngine`, and
 * nothing in navigation, scoring, progress, stats or analytics changes.
 *
 * See docs/GAME_ENGINE_GUIDE.md for the implementation walkthrough.
 */
function notImplementedEngine(id: string): GameEngine<never, never, never, never> {
  const fail = (): never => {
    throw new Error(
      `Game module "${id}" is on the roadmap and has no engine yet. ` +
        'Implement a GameEngine and swap it in — see docs/GAME_ENGINE_GUIDE.md.',
    );
  };
  return {
    id,
    version: 0,
    createInitialState: fail,
    validateMove: fail,
    applyMove: fail,
    isTerminal: fail,
    getOutcome: fail,
    abandon: fail,
    revealSolution: fail,
    describeMove: fail,
  };
}

function roadmapModule(input: {
  id: string;
  titleKey: TranslationKey;
  taglineKey: TranslationKey;
  category: GameModule['category'];
  icon: string;
  variantTitleKey: TranslationKey;
  variantSubtitleKey: TranslationKey;
}): GameModule {
  return {
    id: input.id,
    titleKey: input.titleKey,
    taglineKey: input.taglineKey,
    category: input.category,
    icon: input.icon,
    status: 'coming_soon',
    engine: notImplementedEngine(input.id) as GameEngine,
    variants: [
      {
        id: 'standard',
        titleKey: input.variantTitleKey,
        subtitleKey: input.variantSubtitleKey,
        config: {},
        difficulty: 3,
        unlocksAtLevel: 0,
      },
    ],
    dailyVariantPool: [],
    renderer: 'unavailable',
    scoringProfileId: standardScoringProfile.id,
    scoring: { basePoints: 120, difficultyStep: 0.35 },
  };
}

export const patternModule = roadmapModule({
  id: 'pattern-sense',
  titleKey: 'modules.patternSense',
  taglineKey: 'modules.patternSenseTagline',
  category: 'pattern',
  icon: '🔺',
  variantTitleKey: 'variants.sequence',
  variantSubtitleKey: 'variants.sequenceSubtitle',
});

export const reactionModule = roadmapModule({
  id: 'reaction-lab',
  titleKey: 'modules.reactionLab',
  taglineKey: 'modules.reactionLabTagline',
  category: 'reaction',
  icon: '⚡',
  variantTitleKey: 'variants.goNoGo',
  variantSubtitleKey: 'variants.goNoGoSubtitle',
});

export const reasoningModule = roadmapModule({
  id: 'deduction-room',
  titleKey: 'modules.deductionRoom',
  taglineKey: 'modules.deductionRoomTagline',
  category: 'reasoning',
  icon: '🗝️',
  variantTitleKey: 'variants.constraints',
  variantSubtitleKey: 'variants.constraintsSubtitle',
});

export const upcomingModules: GameModule[] = [
  patternModule,
  reactionModule,
  reasoningModule,
];
