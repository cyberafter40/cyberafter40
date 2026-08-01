import type { TranslationCatalogue } from './en';

/**
 * Types that make an incomplete translation a compile error.
 *
 * `DeepTranslation` mirrors the English catalogue's shape exactly: every group,
 * every key, and — critically — whether a value is a plain string or a plural
 * pair. A locale that omits a key, adds one, or turns a plural into a plain
 * string will not typecheck. That is the difference between a translation
 * system that *can* be complete and one that is *provably* complete.
 */

/** A value that varies by count. Locales differ in which forms they need. */
export interface PluralForms {
  one: string;
  other: string;
}

export type TranslationValue = string | PluralForms;

type Mirror<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends { one: string; other: string }
      ? PluralForms
      : T[K] extends object
        ? Mirror<T[K]>
        : never;
};

/** The contract every locale file must satisfy. */
export type Translation = Mirror<TranslationCatalogue>;

/** Dot-separated key paths, e.g. `home.dailyChallenge`. */
export type TranslationKey = Paths<TranslationCatalogue>;

type Paths<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends { one: string; other: string }
      ? K
      : T[K] extends object
        ? `${K}.${Paths<T[K]>}`
        : never;
}[keyof T & string];

/** Values interpolated into `{placeholders}`. */
export type TranslationParams = Record<string, string | number>;

export const SUPPORTED_LOCALES = ['en', 'tr'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** What the settings screen offers. `system` follows the device. */
export type LocalePreference = Locale | 'system';

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  tr: 'Türkçe',
};
