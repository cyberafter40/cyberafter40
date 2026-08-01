import type {
  ScoreBreakdown,
  ScoreComponent,
  ScoreRating,
  ScoringContext,
  ScoringProfile,
} from './types';

/**
 * Runs a `ScoringProfile` over a finished game.
 *
 * Rules execute in declaration order. `add` rules move the running total by a
 * flat amount; `multiply` rules scale whatever has accumulated so far — which
 * is why order matters and why it lives in the profile rather than being
 * scattered through game code.
 *
 * The function is pure, so the Cloud Function can run the identical pipeline
 * server-side and reject any client that reports a score it did not earn.
 */
export function computeScore(profile: ScoringProfile, ctx: ScoringContext): ScoreBreakdown {
  const components: ScoreComponent[] = [];
  let running = 0;

  for (const rule of profile.rules) {
    if (!rule.applies(ctx)) continue;

    const produced = rule.evaluate(ctx, running);
    if (!produced) continue;

    for (const partial of Array.isArray(produced) ? produced : [produced]) {
      let points: number;
      if (partial.kind === 'add') {
        points = Math.round(partial.value);
        running += points;
      } else {
        const scaled = Math.round(running * partial.value);
        points = scaled - running;
        running = scaled;
      }
      components.push({ ...partial, points });
    }
  }

  const total = Math.max(0, Math.round(running));
  const modeWeight = profile.modeWeights[ctx.result.mode] ?? 1;
  const xp = Math.max(0, Math.round(total * profile.xpRate * modeWeight));

  return {
    total,
    xp,
    rating: rateOutcome(ctx),
    components,
    isPersonalBest: ctx.player.personalBest === null ? total > 0 : total > ctx.player.personalBest,
  };
}

/**
 * Qualitative label for the result screen. Derived from move economy rather
 * than raw score so it stays meaningful across games with different scales.
 */
export function rateOutcome(ctx: ScoringContext): ScoreRating {
  const { status, movesUsed, maxMoves } = ctx.result.outcome;
  if (status !== 'won') return 'failed';

  const used = movesUsed / Math.max(1, maxMoves);
  if (movesUsed === 1) return 'flawless';
  if (used <= 0.4) return 'excellent';
  if (used <= 0.75) return 'solid';
  return 'scraped';
}

export const RATING_COPY: Record<ScoreRating, { title: string; subtitle: string }> = {
  flawless: { title: 'Flawless', subtitle: 'Straight to the answer.' },
  excellent: { title: 'Excellent', subtitle: 'Sharp deduction — barely a wasted move.' },
  solid: { title: 'Solid', subtitle: 'Clean logic, steady pace.' },
  scraped: { title: 'Got there', subtitle: 'Close call. Tomorrow will feel easier.' },
  failed: { title: 'Not this time', subtitle: 'The pattern is clearer than it looks.' },
};
