import type { Rng } from '@/engine/rng';

/** Variant configuration for the number-logic engine. */
export interface NumberLogicConfig {
  /** Code length — 2, 3 and 4 ship in v1. */
  digits: number;
  maxAttempts: number;
  /** When false the secret has no repeated digit (easier to deduce). */
  allowRepeatedDigits: boolean;
  /** When false the code never starts with 0 (reads more like a "number"). */
  allowLeadingZero: boolean;
  /** Id of the `FeedbackPolicy` this variant scores with. */
  policyId: string;
}

const DIGITS = '0123456789'.split('');

/**
 * Above this many possible codes we stop enumerating the candidate space and
 * fall back to a cheaper deduction estimate. 20k keeps the per-guess filter
 * comfortably under a frame budget on a low-end device.
 */
export const CANDIDATE_ENUMERATION_LIMIT = 20_000;

export function codeSpaceSize(config: NumberLogicConfig): number {
  const { digits, allowRepeatedDigits, allowLeadingZero } = config;
  let total = 1;
  for (let i = 0; i < digits; i += 1) {
    const pool = allowRepeatedDigits ? 10 : 10 - i;
    total *= i === 0 && !allowLeadingZero ? pool - 1 : pool;
  }
  return Math.max(0, total);
}

/**
 * Deterministically derives the secret code from the seeded RNG. Same seed →
 * same code, on every device and in the Cloud Function that validates results.
 */
export function generateSecret(config: NumberLogicConfig, rng: Rng): string {
  assertSatisfiable(config);

  const used = new Set<string>();
  let code = '';

  for (let i = 0; i < config.digits; i += 1) {
    const pool = DIGITS.filter((d) => {
      if (!config.allowRepeatedDigits && used.has(d)) return false;
      if (i === 0 && !config.allowLeadingZero && d === '0') return false;
      return true;
    });
    const digit = rng.pick(pool);
    used.add(digit);
    code += digit;
  }

  return code;
}

/**
 * Every code permitted by the configuration. Used to measure how much of the
 * search space each guess eliminated; returns `null` when the space is too
 * large to enumerate cheaply.
 */
export function enumerateCodes(config: NumberLogicConfig): string[] | null {
  if (codeSpaceSize(config) > CANDIDATE_ENUMERATION_LIMIT) return null;

  const out: string[] = [];
  const buffer: string[] = [];
  const used = new Set<string>();

  const unique = !config.allowRepeatedDigits;

  const walk = (position: number): void => {
    if (position === config.digits) {
      out.push(buffer.join(''));
      return;
    }
    for (const digit of DIGITS) {
      if (unique && used.has(digit)) continue;
      if (position === 0 && !config.allowLeadingZero && digit === '0') continue;

      buffer.push(digit);
      if (unique) used.add(digit);

      walk(position + 1);

      buffer.pop();
      if (unique) used.delete(digit);
    }
  };

  walk(0);
  return out;
}

export function isWellFormedGuess(guess: string, config: NumberLogicConfig): boolean {
  if (guess.length !== config.digits) return false;
  return /^[0-9]+$/.test(guess);
}

function assertSatisfiable(config: NumberLogicConfig): void {
  if (config.digits < 1) {
    throw new Error('NumberLogic: `digits` must be at least 1');
  }
  if (!config.allowRepeatedDigits && config.digits > 10) {
    throw new Error('NumberLogic: cannot build a code longer than 10 with unique digits');
  }
  if (codeSpaceSize(config) === 0) {
    throw new Error('NumberLogic: configuration admits no valid codes');
  }
}
