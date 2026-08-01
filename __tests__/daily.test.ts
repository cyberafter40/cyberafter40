import { deriveDailyChallenge, dailySessionId } from '@/daily/challenge';
import { createRng } from '@/engine/rng';
import { registerAllGameModules } from '@/games';
import { getVariant } from '@/engine/registry';
import { generateSecret } from '@/games/numberLogic/generator';
import { addDays, daysBetween, formatCountdown, msUntilNextUtcDay, toDateKey, toWeekKey } from '@/utils/date';

registerAllGameModules();

describe('date keys', () => {
  it('uses UTC so the challenge boundary is the same worldwide', () => {
    // 23:30 UTC on 1 Jan is still 1 Jan, even where it is already 2 Jan locally.
    expect(toDateKey(Date.UTC(2026, 0, 1, 23, 30))).toBe('2026-01-01');
    expect(toDateKey(Date.UTC(2026, 0, 2, 0, 1))).toBe('2026-01-02');
  });

  it('measures and adds whole days', () => {
    expect(daysBetween('2026-01-01', '2026-01-08')).toBe(7);
    expect(daysBetween('2026-01-08', '2026-01-01')).toBe(-7);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('counts down to the next UTC midnight', () => {
    const remaining = msUntilNextUtcDay(Date.UTC(2026, 0, 1, 23, 0));
    expect(remaining).toBe(60 * 60 * 1000);
    expect(formatCountdown(remaining)).toBe('01:00:00');
    expect(formatCountdown(-5)).toBe('00:00:00');
  });

  it('produces ISO week keys', () => {
    expect(toWeekKey(Date.UTC(2026, 0, 1))).toMatch(/^\d{4}-W\d{2}$/);
    expect(toWeekKey(Date.UTC(2026, 0, 5))).toBe(toWeekKey(Date.UTC(2026, 0, 8)));
  });
});

describe('deriveDailyChallenge', () => {
  it('is identical for every caller on the same date', () => {
    const a = deriveDailyChallenge('2026-08-01');
    const b = deriveDailyChallenge('2026-08-01');
    expect(a).toEqual(b);
  });

  it('gives different dates different puzzles', () => {
    const a = deriveDailyChallenge('2026-08-01');
    const b = deriveDailyChallenge('2026-08-02');
    expect(a.seed).not.toBe(b.seed);
  });

  it('only picks variants the module actually offers for daily play', () => {
    for (let day = 1; day <= 28; day += 1) {
      const challenge = deriveDailyChallenge(`2026-02-${`${day}`.padStart(2, '0')}`);
      expect(['two-digit', 'three-digit']).toContain(challenge.variantId);
    }
  });

  it('produces the same secret code on any device from the shared seed', () => {
    const challenge = deriveDailyChallenge('2026-08-01');
    const variant = getVariant(challenge.moduleId, challenge.variantId);

    const onPhone = generateSecret(variant.config, createRng(challenge.seed));
    const onServer = generateSecret(variant.config, createRng(challenge.seed));
    expect(onPhone).toBe(onServer);
  });

  it('builds a deterministic session id so one attempt cannot become two', () => {
    expect(dailySessionId('user123', '2026-08-01')).toBe('user123_2026-08-01');
  });
});
