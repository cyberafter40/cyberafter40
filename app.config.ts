import type { ExpoConfig } from 'expo/config';

/**
 * Expo app configuration.
 *
 * Firebase keys are injected from the environment so that no credentials are
 * committed to the repository. Locally they come from `.env` (loaded by Expo
 * CLI); in CI/EAS they come from the EAS environment variables configured per
 * build profile. See docs/DEPLOYMENT_APPSTORE.md.
 *
 * Note: Firebase Web API keys are *not* secrets — they identify the project,
 * they do not authorise it. Access control lives in Firestore rules and the
 * Cloud Functions in `functions/`.
 */
const config: ExpoConfig = {
  name: 'MindCode',
  slug: 'mindcode',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'mindcode',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0E1116',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.mindcode.app',
    buildNumber: '1',
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      CFBundleDisplayName: 'MindCode',
      ITSAppUsesNonExemptEncryption: false,
      // iOS filters `Locale.preferredLanguages` — which is what
      // expo-localization reads — against the localizations an app *declares*.
      // Without this, a Turkish device reports `en` and "Match device" silently
      // never resolves to Turkish, no matter how complete the catalogue is.
      // Keep in step with SUPPORTED_LOCALES in src/i18n/types.ts.
      CFBundleLocalizations: ['en', 'tr'],
    },
  },
  android: {
    package: 'com.mindcode.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0E1116',
    },
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? '',
    },
    firebase: {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
      measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '',
    },
  },
};

export default config;
