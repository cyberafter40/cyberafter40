/**
 * Feedback policies for the number-logic game.
 *
 * The brief's rule — correct digit in the correct place is +1, correct digit in
 * the wrong place is −1, wrong digit is 0 — is **one policy among several**, not
 * a hardcoded rule. The engine computes structural match counts (exact,
 * misplaced, absent) and then asks a policy what those counts are worth.
 *
 * That indirection buys us: alternative difficulty flavours, seasonal
 * "inverted" events, classic Bulls & Cows scoring for players who find negative
 * numbers confusing, and A/B tests on which feedback shape teaches fastest —
 * all without touching the engine.
 */

export interface DigitMatchCounts {
  /** Right digit, right position. */
  exact: number;
  /** Right digit, wrong position. */
  misplaced: number;
  /** Digit not present in the secret at all. */
  absent: number;
}

export interface FeedbackPolicy {
  id: string;
  label: string;
  description: string;
  weights: { exact: number; misplaced: number; absent: number };
  /** Renders the numeric score for the UI, e.g. `+2`, `0`, `−2`. */
  format(score: number): string;
  /** Legend copy for the How to Play sheet. */
  legend: { exact: string; misplaced: string; absent: string };
  /** Score that means "solved" for a code of `digits` length. */
  winningScore(digits: number): number;
}

function signed(score: number): string {
  if (score === 0) return '0';
  // U+2212 minus sign — visually balanced against '+' in the result pills.
  return score > 0 ? `+${score}` : `−${Math.abs(score)}`;
}

/** The MindCode default: +1 / −1 / 0. */
export const plusMinusPolicy: FeedbackPolicy = {
  id: 'plus-minus',
  label: 'Plus / Minus',
  description: 'Right place +1, right digit wrong place −1, wrong digit 0.',
  weights: { exact: 1, misplaced: -1, absent: 0 },
  format: signed,
  legend: {
    exact: 'Correct digit, correct position',
    misplaced: 'Correct digit, wrong position',
    absent: 'Digit is not in the code',
  },
  winningScore: (digits) => digits,
};

/** Everything positive — a gentler onboarding variant. */
export const positiveOnlyPolicy: FeedbackPolicy = {
  id: 'positive',
  label: 'Positive',
  description: 'Right place +2, right digit wrong place +1, wrong digit 0.',
  weights: { exact: 2, misplaced: 1, absent: 0 },
  format: (score) => `${score}`,
  legend: {
    exact: 'Correct digit, correct position',
    misplaced: 'Correct digit, wrong position',
    absent: 'Digit is not in the code',
  },
  winningScore: (digits) => digits * 2,
};

/** Position-only feedback — considerably harder; reserved for expert modes. */
export const strictPolicy: FeedbackPolicy = {
  id: 'strict',
  label: 'Strict',
  description: 'Only exact positions count. Misplaced digits tell you nothing.',
  weights: { exact: 1, misplaced: 0, absent: 0 },
  format: signed,
  legend: {
    exact: 'Correct digit, correct position',
    misplaced: 'No information given',
    absent: 'No information given',
  },
  winningScore: (digits) => digits,
};

const policies: Record<string, FeedbackPolicy> = {
  [plusMinusPolicy.id]: plusMinusPolicy,
  [positiveOnlyPolicy.id]: positiveOnlyPolicy,
  [strictPolicy.id]: strictPolicy,
};

export function getFeedbackPolicy(id: string): FeedbackPolicy {
  const policy = policies[id];
  if (!policy) throw new Error(`Unknown feedback policy "${id}"`);
  return policy;
}

export function scoreCounts(policy: FeedbackPolicy, counts: DigitMatchCounts): number {
  return (
    counts.exact * policy.weights.exact +
    counts.misplaced * policy.weights.misplaced +
    counts.absent * policy.weights.absent
  );
}
