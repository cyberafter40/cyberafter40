import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  // @ts-expect-error — shipped by firebase/auth for React Native but not in the
  // web type surface. See https://github.com/firebase/firebase-js-sdk/issues/7615
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';

/**
 * Firebase bootstrap.
 *
 * Initialisation is lazy and idempotent so Fast Refresh does not create a
 * second app instance, and so unit tests can import domain modules without ever
 * touching the network.
 *
 * Setting `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` points auth, Firestore and
 * callable functions at the local emulator suite instead of a real project.
 * That is what local development should use — and it is what makes a real
 * end-to-end test possible, since the app then exercises the actual security
 * rules and the actual `submitGameResult` transaction rather than a mock.
 */

/** Host running the emulator suite, or null for a real Firebase project. */
const EMULATOR_HOST = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || null;

const EMULATOR_PORTS = { auth: 9099, firestore: 8080, functions: 5001 } as const;

export function isUsingEmulators(): boolean {
  return EMULATOR_HOST !== null;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

function readConfig(): FirebaseConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as { firebase?: Partial<FirebaseConfig> };
  const cfg = extra.firebase ?? {};

  const required: (keyof FirebaseConfig)[] = ['apiKey', 'projectId', 'appId', 'authDomain'];
  const missing = required.filter((key) => !cfg[key]);

  if (missing.length > 0) {
    throw new Error(
      `Firebase is not configured: missing ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill in the values from the Firebase console.',
    );
  }

  return cfg as FirebaseConfig;
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let functionsInstance: Functions | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  app = getApps().length > 0 ? getApp() : initializeApp(readConfig());
  return app;
}

export function getFirebaseAuth(): Auth {
  if (authInstance) return authInstance;
  const instance = getFirebaseApp();
  try {
    // AsyncStorage persistence keeps players signed in across launches.
    authInstance = initializeAuth(instance, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Already initialised (Fast Refresh, or a second import path).
    authInstance = getAuth(instance);
  }

  if (EMULATOR_HOST) {
    connectAuthEmulator(authInstance, `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`, {
      disableWarnings: true,
    });
  }
  return authInstance;
}

export function getDb(): Firestore {
  if (dbInstance) return dbInstance;
  const instance = getFirebaseApp();
  try {
    dbInstance = initializeFirestore(instance, {
      // Long polling avoids the streaming-transport issues the JS SDK hits on
      // some React Native networks; auto-detection picks it only when needed.
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    dbInstance = getFirestore(instance);
  }

  if (EMULATOR_HOST) {
    connectFirestoreEmulator(dbInstance, EMULATOR_HOST, EMULATOR_PORTS.firestore);
  }
  return dbInstance;
}

export function getFirebaseFunctions(): Functions {
  if (!functionsInstance) {
    functionsInstance = getFunctions(getFirebaseApp());
    if (EMULATOR_HOST) {
      connectFunctionsEmulator(functionsInstance, EMULATOR_HOST, EMULATOR_PORTS.functions);
    }
  }
  return functionsInstance;
}

/** True when the app has enough configuration to talk to Firebase at all. */
export function isFirebaseConfigured(): boolean {
  try {
    readConfig();
    return true;
  } catch {
    return false;
  }
}
