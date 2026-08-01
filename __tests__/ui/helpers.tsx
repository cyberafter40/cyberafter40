import React, { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { registerAllGameModules } from '@/games';
import { createProfile, type UserProfile } from '@/progress/types';
import { ThemeProvider } from '@/ui/ThemeProvider';

/**
 * Test harness.
 *
 * Wraps components in the providers they genuinely need, with real
 * implementations — the theme resolves for real, the safe-area insets are real.
 * Only the profile is injected, because in production it arrives from Firestore
 * and this suite never touches the network.
 */

registerAllGameModules();

/** Safe-area metrics for a notched phone, so insets are deterministic. */
const INSETS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    ...createProfile({
      uid: 'test-uid',
      displayName: 'Quiet Falcon',
      isAnonymous: false,
      now: 1_700_000_000_000,
    }),
    ...overrides,
  };
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={INSETS}>
      <ThemeProvider preference="dark">{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: Providers, ...options });
}

export * from '@testing-library/react-native';
