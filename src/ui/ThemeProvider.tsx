import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { buildTheme, type ColorScheme, type Theme } from './theme';

/**
 * Theme context.
 *
 * Resolution order: the player's explicit setting, then the OS appearance.
 * MindCode is often played last thing at night, so respecting dark mode is a
 * comfort feature, not a preference toggle.
 */

const ThemeContext = createContext<Theme>(buildTheme('dark'));

export function ThemeProvider({
  children,
  preference = 'system',
}: {
  children: ReactNode;
  preference?: 'system' | ColorScheme;
}) {
  const systemScheme = useColorScheme();
  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  const theme = useMemo(() => buildTheme(scheme), [scheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
