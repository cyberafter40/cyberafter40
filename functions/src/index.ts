// `module-alias` must be registered before anything resolves an `@/…` import.
// The shared domain code compiled out of ../src uses that alias throughout, and
// TypeScript path mapping is compile-time only. See functions/tsconfig.json.
import 'module-alias/register';

import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';
import { registerAllGameModules } from '@/games';

/**
 * MindCode Cloud Functions.
 *
 * Three responsibilities, and deliberately no more:
 *   - `submitGameResult` — the only writer of scores, XP, streaks and boards.
 *   - `deleteAccount`    — full erasure, required for App Store compliance.
 *   - `provisionDailyChallenges` — creates the daily challenge documents.
 *
 * Game rules are not re-implemented here. The functions import the exact engine,
 * scoring and progress modules the app ships, so the server and the client can
 * never disagree about what a game was worth.
 */
initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 100 });

// Engines must be in the registry before any request is served.
registerAllGameModules();

export { submitGameResult } from './submit';
export { deleteAccount } from './account';
export { provisionDailyChallenges } from './daily';
