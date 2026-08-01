import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { registerAllGameModules } from '@/games';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { RootNavigator } from '@/navigation/RootNavigator';
import {
  consoleTransport,
  noopTransport,
  registerAnalyticsTransport,
  track,
} from '@/services/analytics';
import { hasOnboarded } from '@/services/storage';
import { flushPendingResults } from '@/services/submission';
import { AuthProvider } from '@/state/AuthContext';
import { ProfileProvider, useProfile } from '@/state/ProfileContext';
import { ErrorBoundary } from '@/ui/ErrorBoundary';
import { ThemeProvider, useTheme } from '@/ui/ThemeProvider';

/**
 * Application root.
 *
 * Order matters here: game modules are registered before any screen can look
 * one up, and analytics gets a transport before the first `app_open` event so
 * nothing from the first session is dropped.
 */
registerAllGameModules();
registerAnalyticsTransport(__DEV__ ? consoleTransport : noopTransport);

function Splash() {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.bg,
      }}
    >
      <ActivityIndicator color={theme.colors.accent} />
    </View>
  );
}

/** Reads the theme preference out of the profile once it is available. */
function ThemedApp({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  return <ThemeProvider preference={profile?.settings.theme ?? 'system'}>{children}</ThemeProvider>;
}

function Shell() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    void hasOnboarded().then((done) => {
      setOnboarded(done);
      track('app_open', { isReturning: done });
    });
  }, []);

  // Anything finished offline gets pushed as soon as the app comes forward.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void flushPendingResults();
    });
    return () => subscription.remove();
  }, []);

  if (onboarded === null) return <Splash />;
  if (!onboarded) return <OnboardingScreen onDone={() => setOnboarded(true)} />;
  return <RootNavigator />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <ProfileProvider>
            <ThemedApp>
              <Shell />
            </ThemedApp>
          </ProfileProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
