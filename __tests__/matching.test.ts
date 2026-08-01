import { compareCodes, isConsistentWithScore } from '@/games/numberLogic/matching';
import { plusMinusPolicy, positiveOnlyPolicy, scoreCounts } from '@/games/numberLogic/policies';

const score = (secret: string, guess: string) =>
  scoreCounts(plusMinusPolicy, compareCodes(secret, guess));

describe('compareCodes', () => {
  it('reproduces the examples from the game rules', () => {
    // Hidden number: 82
    expect(score('82', '56')).toBe(0);
    expect(score('82', '28')).toBe(-2);
    expect(score('82', '82')).toBe(2);
  });

  it('counts exact matches before misplaced ones', () => {
    expect(compareCodes('123', '132')).toEqual({ exact: 1, misplaced: 2, absent: 0 });
  });

  it('never credits a secret digit twice when the guess repeats it', () => {
    // Secret has a single 1; the guess offers three.
    expect(compareCodes('123', '111')).toEqual({ exact: 1, misplaced: 0, absent: 2 });
  });

  it('handles duplicates on both sides as multisets', () => {
    expect(compareCodes('1123', '1213')).toEqual({ exact: 2, misplaced: 2, absent: 0 });
  });

  it('always partitions every position exactly once', () => {
    const secret = '4071';
    for (const guess of ['0000', '1234', '4071', '7104', '9999']) {
      const counts = compareCodes(secret, guess);
      expect(counts.exact + counts.misplaced + counts.absent).toBe(secret.length);
    }
  });

  it('rejects a length mismatch rather than silently truncating', () => {
    expect(() => compareCodes('82', '821')).toThrow(/length mismatch/);
  });
});

describe('feedback policies', () => {
  it('scores the same match counts differently per policy', () => {
    const counts = compareCodes('82', '28');
    expect(scoreCounts(plusMinusPolicy, counts)).toBe(-2);
    expect(scoreCounts(positiveOnlyPolicy, counts)).toBe(2);
  });

  it('formats the plus/minus policy with explicit signs', () => {
    expect(plusMinusPolicy.format(2)).toBe('+2');
    expect(plusMinusPolicy.format(0)).toBe('0');
    expect(plusMinusPolicy.format(-2)).toBe('−2');
  });
});

describe('isConsistentWithScore', () => {
  it('keeps candidates that would have produced the same observed score', () => {
    // Under +1/−1 a score of 0 is ambiguous: nothing matched, or one exact hit
    // was cancelled by one misplaced digit. Both candidates must survive.
    expect(isConsistentWithScore('56', '17', 0, plusMinusPolicy)).toBe(true);
    expect(isConsistentWithScore('12', '13', 0, plusMinusPolicy)).toBe(false);
    expect(isConsistentWithScore('13', '31', -2, plusMinusPolicy)).toBe(true);
  });
});
