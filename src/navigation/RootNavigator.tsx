import React from 'react';
import { Platform, View } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BadgesScreen } from '@/screens/BadgesScreen';
import { AuthScreen } from '@/screens/AuthScreen';
import { GameScreen } from '@/screens/GameScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { HowToPlayScreen } from '@/screens/HowToPlayScreen';
import { LeaderboardScreen } from '@/screens/LeaderboardScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { ResultScreen } from '@/screens/ResultScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { useTranslation } from '@/i18n/LocaleProvider';
import { Text } from '@/ui/components';
import { useTheme } from '@/ui/ThemeProvider';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, string> = {
  Home: '◆',
  Leaderboard: '≡',
  Profile: '●',
};

function TabsNavigator() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textFaint,
        tabBarStyle: {
          backgroundColor: theme.colors.bg,
          borderTopColor: theme.colors.border,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color }) => (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color }}>{TAB_ICONS[route.name]}</Text>
          </View>
        ),
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: t('nav.play') }} />
      <Tabs.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{ title: t('nav.ranks') }}
      />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: t('nav.you') }} />
    </Tabs.Navigator>
  );
}

/**
 * Root navigation.
 *
 * A tab shell for the three persistent destinations, with the game, result and
 * settings pushed as full-screen stack routes. The game is presented modally so
 * that leaving it always returns to where the player started.
 */
export function RootNavigator() {
  const theme = useTheme();
  const { t } = useTranslation();

  const navTheme: NavTheme = {
    ...(theme.scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.scheme === 'dark' ? DarkTheme : DefaultTheme).colors,
      background: theme.colors.bg,
      card: theme.colors.bg,
      text: theme.colors.text,
      border: theme.colors.border,
      primary: theme.colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="Tabs" component={TabsNavigator} />
        <Stack.Screen
          name="Game"
          component={GameScreen}
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
        <Stack.Screen
          name="Result"
          component={ResultScreen}
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ presentation: 'modal', headerShown: true, title: '' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ headerShown: true, title: t('settings.title') }}
        />
        <Stack.Screen
          name="Badges"
          component={BadgesScreen}
          options={{ headerShown: true, title: t('badges.title') }}
        />
        <Stack.Screen
          name="HowToPlay"
          component={HowToPlayScreen}
          options={{ presentation: 'modal', headerShown: true, title: '' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
