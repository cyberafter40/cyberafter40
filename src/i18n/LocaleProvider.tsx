import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getLocales } from 'expo-localization';
import { getLocale, resolvePreference, setLocale, t as translate } from './index';
import type { Locale, LocalePreference, TranslationKey, TranslationParams } from './types';

/**
 * Locale context.
 *
 * `setLocale` is called during render rather than in an effect on purpose: the
 * very first paint must already be in the right language. A locale applied in
 * `useEffect` shows one frame of English to a Turkish speaker, which is exactly
 * the kind of detail that makes an app feel imported rather than built for you.
 *
 * The device's ordered locale list is read once — it cannot change without the
 * OS restarting the app.
 */

interface LocaleContextValue {
  locale: Locale;
  /** Translate a key in the active locale. */
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: getLocale(),
  t: translate,
});

/** Device locale tags, most-preferred first, e.g. `['tr-TR', 'en-US']`. */
function deviceLocaleTags(): string[] {
  try {
    return getLocales().map((entry) => entry.languageTag);
  } catch {
    // getLocales throws in environments without the native module (tests, web
    // before hydration). English is the documented fallback.
    return [];
  }
}

export function LocaleProvider({
  children,
  preference = 'system',
}: {
  children: ReactNode;
  preference?: LocalePreference;
}) {
  const locale = resolvePreference(preference, deviceLocaleTags());

  // Applied synchronously so the first render is already translated, including
  // for code that calls the module-level `t()` outside React.
  if (getLocale() !== locale) setLocale(locale);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: (key, params) => translate(key, params) }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Returns `t` bound to the active locale.
 *
 * Components must use this rather than importing `t` directly, so that changing
 * the language re-renders them. The module-level `t` is for non-React code
 * (engine errors, service messages) where there is nothing to re-render.
 */
export function useTranslation(): LocaleContextValue {
  return useContext(LocaleContext);
}
