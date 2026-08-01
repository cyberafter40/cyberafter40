import type { GameEngine, GameModule } from '@/engine/types';
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
  title: string;
  tagline: string;
  category: GameModule['category'];
  icon: string;
  variantTitle: string;
  variantSubtitle: string;
}): GameModule {
  return {
    id: input.id,
    title: input.title,
    tagline: input.tagline,
    category: input.category,
    icon: input.icon,
    status: 'coming_soon',
    engine: notImplementedEngine(input.id) as GameEngine,
    variants: [
      {
        id: 'standard',
        title: input.variantTitle,
        subtitle: input.variantSubtitle,
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

export const memoryModule = roadmapModule({
  id: 'memory-grid',
  title: 'Memory Grid',
  tagline: 'Hold the pattern, then rebuild it.',
  category: 'memory',
  icon: '🧠',
  variantTitle: 'Grid Recall',
  variantSubtitle: 'Sequences that grow one tile at a time.',
});

export const patternModule = roadmapModule({
  id: 'pattern-sense',
  title: 'Pattern Sense',
  tagline: 'Find the rule, predict what comes next.',
  category: 'pattern',
  icon: '🔺',
  variantTitle: 'Sequence',
  variantSubtitle: 'Numeric and visual progressions.',
});

export const reactionModule = roadmapModule({
  id: 'reaction-lab',
  title: 'Reaction Lab',
  tagline: 'Measure how fast your decisions actually are.',
  category: 'reaction',
  icon: '⚡',
  variantTitle: 'Go / No-Go',
  variantSubtitle: 'Respond to the right signal, ignore the rest.',
});

export const reasoningModule = roadmapModule({
  id: 'deduction-room',
  title: 'Deduction Room',
  tagline: 'Short logic puzzles with one consistent answer.',
  category: 'reasoning',
  icon: '🗝️',
  variantTitle: 'Constraints',
  variantSubtitle: 'Eliminate the impossible.',
});

export const upcomingModules: GameModule[] = [
  memoryModule,
  patternModule,
  reactionModule,
  reasoningModule,
];
