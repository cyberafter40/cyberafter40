import { en } from '@/i18n/en';
import { tr } from '@/i18n/tr';
import {
  catalogueKeys,
  DEFAULT_LOCALE,
  getLocale,
  isSupportedLocale,
  resolveDeviceLocale,
  resolvePreference,
  setLocale,
  SUPPORTED_LOCALES,
  t,
} from '@/i18n';

/**
 * Localization tests.
 *
 * Completeness is already a compile-time guarantee — `tr.ts` is typed as
 * `Translation`, so a missing key fails `tsc`. These tests cover what types
 * cannot: that no locale has *extra* keys, that placeholders match between
 * locales (a translator dropping `{score}` produces a sentence with a hole in
 * it, and that compiles fine), and that plural selection follows each
 * language's own rule rather than English's.
 */

afterEach(() => setLocale(DEFAULT_LOCALE));

describe('catalogue completeness', () => {
  it('gives every locale exactly the same keys', () => {
    const reference = catalogueKeys('en');
    for (const locale of SUPPORTED_LOCALES) {
      expect(catalogueKeys(locale)).toEqual(reference);
    }
  });

  it('covers a meaningful surface, so the test is not vacuous', () => {
    expect(catalogueKeys('en').length).toBeGreaterThan(120);
  });

  it('uses the same placeholders in every locale', () => {
    const placeholders = (value: unknown): string[] => {
      const text = typeof value === 'string' ? value : Object.values(value as object).join(' ');
      return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();
    };

    const walk = (a: object, b: object, path = ''): void => {
      for (const [key, valueA] of Object.entries(a)) {
        const valueB = (b as Record<string, unknown>)[key];
        const here = path ? `${path}.${key}` : key;

        if (typeof valueA === 'object' && valueA !== null && !('one' in valueA)) {
          walk(valueA, valueB as object, here);
          continue;
        }
        // A translation that drops a placeholder still compiles, and leaves a
        // sentence missing the number it was supposed to report.
        expect({ key: here, params: placeholders(valueB) }).toEqual({
          key: here,
          params: placeholders(valueA),
        });
      }
    };

    walk(en, tr);
  });

  it('leaves no string empty', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of catalogueKeys(locale)) {
        setLocale(locale);
        expect(t(key as never).trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('t()', () => {
  it('returns the active locale’s string', () => {
    setLocale('en');
    expect(t('home.dailyChallenge')).toBe('Daily Challenge');
    setLocale('tr');
    expect(t('home.dailyChallenge')).toBe('Günün Meydan Okuması');
  });

  it('interpolates named placeholders', () => {
    setLocale('en');
    expect(t('home.unlocksAtLevel', { level: 8 })).toBe('Unlocks at level 8');
    setLocale('tr');
    expect(t('home.unlocksAtLevel', { level: 8 })).toBe('Seviye 8’te açılır');
  });

  it('leaves an unknown placeholder untouched rather than printing undefined', () => {
    setLocale('en');
    expect(t('home.unlocksAtLevel', {})).toBe('Unlocks at level {level}');
  });

  it('selects the English plural form by count', () => {
    setLocale('en');
    expect(t('home.dailySolved', { count: 1, score: 310 })).toBe(
      'Solved in 1 guess for 310 points.',
    );
    expect(t('home.dailySolved', { count: 3, score: 310 })).toBe(
      'Solved in 3 guesses for 310 points.',
    );
  });

  it('follows Turkish’s rule, which does not inflect after a numeral', () => {
    setLocale('tr');
    // "1 tahmin" and "3 tahmin" — not "3 tahminler". Applying English's rule
    // here would produce text a Turkish speaker would find wrong.
    expect(t('leaderboard.guesses', { count: 1 })).toBe('1 tahmin');
    expect(t('leaderboard.guesses', { count: 3 })).toBe('3 tahmin');
  });

  it('falls back to English rather than rendering a blank', () => {
    setLocale('tr');
    // Not reachable through the typed API; proves the runtime degrades safely.
    expect(t('does.not.exist' as never)).toBe('does.not.exist');
  });
});

describe('locale resolution', () => {
  it('maps a device tag to a supported locale', () => {
    expect(resolveDeviceLocale(['tr-TR'])).toBe('tr');
    expect(resolveDeviceLocale(['en-GB'])).toBe('en');
    expect(resolveDeviceLocale(['TR'])).toBe('tr');
  });

  it('falls back to English for an unsupported language', () => {
    expect(resolveDeviceLocale(['ja-JP', 'ko-KR'])).toBe('en');
    expect(resolveDeviceLocale([])).toBe('en');
  });

  it('prefers the first supported tag in the device’s ordered list', () => {
    expect(resolveDeviceLocale(['ja-JP', 'tr-TR', 'en-US'])).toBe('tr');
  });

  it('honours an explicit preference over the device', () => {
    expect(resolvePreference('en', ['tr-TR'])).toBe('en');
    expect(resolvePreference('tr', ['en-US'])).toBe('tr');
    expect(resolvePreference('system', ['tr-TR'])).toBe('tr');
  });

  it('ignores an unsupported locale rather than blanking the app', () => {
    setLocale('ja' as never);
    expect(getLocale()).toBe(DEFAULT_LOCALE);
    expect(isSupportedLocale('ja')).toBe(false);
  });
});
