import { scoreCounts, type DigitMatchCounts, type FeedbackPolicy } from './policies';

/**
 * Structural comparison of a guess against a secret code.
 *
 * Duplicate digits are the subtle part. `exact` matches are consumed first,
 * then leftover secret digits are matched greedily against leftover guess
 * digits as multisets. That guarantees `exact + misplaced + absent === length`
 * and that no secret digit is ever credited twice.
 *
 * Example — secret `1123`, guess `1213`:
 *   positions 0 and 3 match exactly → exact = 2
 *   leftovers: secret {1,2}, guess {2,1} → misplaced = 2
 *   absent = 0
 */
export function compareCodes(secret: string, guess: string): DigitMatchCounts {
  if (secret.length !== guess.length) {
    throw new Error(
      `compareCodes: length mismatch (secret ${secret.length}, guess ${guess.length})`,
    );
  }

  let exact = 0;
  const secretRest = new Map<string, number>();
  const guessRest = new Map<string, number>();

  for (let i = 0; i < secret.length; i += 1) {
    const s = secret[i] as string;
    const g = guess[i] as string;
    if (s === g) {
      exact += 1;
    } else {
      secretRest.set(s, (secretRest.get(s) ?? 0) + 1);
      guessRest.set(g, (guessRest.get(g) ?? 0) + 1);
    }
  }

  let misplaced = 0;
  for (const [digit, count] of guessRest) {
    misplaced += Math.min(count, secretRest.get(digit) ?? 0);
  }

  return { exact, misplaced, absent: secret.length - exact - misplaced };
}

/**
 * Whether `candidate` survives a guess, judged by what the player actually
 * saw — the single policy-weighted number.
 *
 * This deliberately uses the *observable* score rather than the underlying
 * counts. Under the +1/−1 policy a score of 0 is ambiguous (nothing matched, or
 * one exact hit cancelled by one misplaced digit), and that ambiguity is the
 * game. Filtering on the hidden counts would credit the player with knowledge
 * they never had and inflate the deduction metric.
 */
export function isConsistentWithScore(
  candidate: string,
  guess: string,
  observedScore: number,
  policy: FeedbackPolicy,
): boolean {
  return scoreCounts(policy, compareCodes(candidate, guess)) === observedScore;
}

/**
 * Structural consistency — matches on the raw counts. Not used for the
 * deduction metric (see above); it is the primitive a future hint system will
 * use, where the app *does* get to reason with full information.
 */
export function isConsistent(
  candidate: string,
  guess: string,
  counts: DigitMatchCounts,
): boolean {
  const actual = compareCodes(candidate, guess);
  return actual.exact === counts.exact && actual.misplaced === counts.misplaced;
}
