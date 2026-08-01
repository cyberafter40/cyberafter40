declare const __DEV__: boolean | undefined;

import { en } from './en';
import { tr } from './tr';
import {
  SUPPORTED_LOCALES,
  type Locale,
  type LocalePreference,
  type Translation,
  type TranslationKey,
  type TranslationParams,
  type TranslationValue,
} from './types';

/**
 * Translation runtime.
 *
 * Deliberately dependency-free. i18next and friends bring a plugin system,
 * async loading and a namespace resolver that this app has no use for; what it
 * needs is lookup, interpolation and plurals — about sixty lines — plus the
 * type safety that a JSON-based library actively prevents.
 *
 * Two rules hold the system together:
 *  1. Every locale is typed against the English catalogue, so an incomplete
 *     translation fails the build (see types.ts).
 *  2. A missing key at runtime still renders English rather than a blank or a
 *     raw key. Types make that unreachable; the fallback is there because a
 *     shipped app should degrade, not disappear.
 */

const catalogues: Record<Locale, Translation> = { en, tr };

export const DEFAULT_LOCALE: Locale = 'en';

let activeLocale: Locale = DEFAULT_LOCALE;

export function setLocale(locale: Locale): void {
  activeLocale = catalogues[locale] ? locale : DEFAULT_LOCALE;
}

export function getLocale(): Locale {
  return activeLocale;
}

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Maps a device locale tag (`tr-TR`, `en-GB`) to a supported locale.
 * Falls back to English rather than guessing at a near match.
 */
export function resolveDeviceLocale(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const base = tag.split(/[-_]/)[0]?.toLowerCase();
    if (base && isSupportedLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

export function resolvePreference(
  preference: LocalePreference,
  deviceTags: readonly string[],
): Locale {
  return preference === 'system' ? resolveDeviceLocale(deviceTags) : preference;
}

/**
 * Plural rules, per locale.
 *
 * English distinguishes one from everything else. Turkish does not inflect a
 * noun after a numeral at all, so it always takes `other`. Keeping this as a
 * per-locale function is what lets a language with more forms be added without
 * touching call sites.
 */
const pluralRules: Record<Locale, (count: number) => keyof PluralShape> = {
  en: (count) => (Math.abs(count) === 1 ? 'one' : 'other'),
  tr: () => 'other',
};

interface PluralShape {
  one: string;
  other: string;
}

function lookup(locale: Locale, key: string): TranslationValue | undefined {
  // Defensive: the typed API cannot pass a non-string, but data crossing a
  // network boundary (a stored score breakdown, a persisted event) can carry a
  // missing key, and a missing label must not crash a screen.
  if (typeof key !== 'string' || key.length === 0) return undefined;

  let node: unknown = catalogues[locale];
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string' || isPlural(node) ? (node as TranslationValue) : undefined;
}

function isPlural(value: unknown): value is PluralShape {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PluralShape).one === 'string' &&
    typeof (value as PluralShape).other === 'string'
  );
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Translates a key in the active locale.
 *
 * Pass `count` to select a plural form — it is also available to the template
 * as `{count}`.
 *
 * @example t('home.play')
 * @example t('numberLogic.guessesLeft', { count: 3, policy: 'Plus / Minus' })
 */
export function t(key: TranslationKey, params?: TranslationParams): string {
  const value = lookup(activeLocale, key) ?? lookup(DEFAULT_LOCALE, key);

  if (value === undefined) {
    // Unreachable through the typed API; a shipped app should still not show a
    // blank where a sentence belongs.
    //
    // `__DEV__` is guarded rather than referenced directly: this module sits in
    // the dependency-free layer, which must not assume React Native globals.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] missing key: ${String(key)}`);
    }
    return typeof key === 'string' ? key : '';
  }

  if (typeof value === 'string') return interpolate(value, params);

  const count = Number(params?.count ?? 0);
  const form = pluralRules[activeLocale](count);
  return interpolate(value[form], params);
}

/** Every key in the catalogue, flattened. Used by the completeness tests. */
export function catalogueKeys(locale: Locale = DEFAULT_LOCALE): string[] {
  const out: string[] = [];
  const walk = (node: unknown, prefix: string): void => {
    if (typeof node === 'string' || isPlural(node)) {
      out.push(prefix);
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    for (const [key, child] of Object.entries(node)) {
      walk(child, prefix ? `${prefix}.${key}` : key);
    }
  };
  walk(catalogues[locale], '');
  return out.sort();
}

export { SUPPORTED_LOCALES, LOCALE_NAMES } from './types';
export type { Locale, LocalePreference, TranslationKey, TranslationParams } from './types';
