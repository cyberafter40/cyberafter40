/**
 * Analytics façade.
 *
 * The app never calls a vendor SDK directly. It emits a small, typed set of
 * domain events through a pluggable transport, which buys three things:
 *
 *  1. Event names and payloads are defined once and type-checked, so the
 *     funnel does not rot as screens change.
 *  2. Firebase Analytics has no React Native implementation in the JS SDK —
 *     native builds register the `@react-native-firebase/analytics` transport
 *     (see `registerAnalyticsTransport` and docs/DEPLOYMENT_APPSTORE.md) while
 *     Expo Go and tests use the console/no-op transport. Neither the call sites
 *     nor the tests change.
 *  3. Events emitted before the transport is ready are buffered rather than
 *     lost — first-session events are the ones that matter most.
 */

export type AnalyticsEvent =
  | { name: 'app_open'; params: { isReturning: boolean } }
  | { name: 'sign_up'; params: { method: 'email' | 'anonymous' } }
  | { name: 'login'; params: { method: 'email' | 'anonymous' } }
  | { name: 'account_linked'; params: Record<string, never> }
  | {
      name: 'game_start';
      params: { moduleId: string; variantId: string; mode: string; difficulty: number };
    }
  | {
      name: 'guess_submitted';
      params: { moduleId: string; variantId: string; attempt: number; score: number };
    }
  | {
      name: 'game_complete';
      params: {
        moduleId: string;
        variantId: string;
        mode: string;
        status: string;
        movesUsed: number;
        durationMs: number;
        score: number;
        xp: number;
      };
    }
  | { name: 'daily_challenge_complete'; params: { challengeId: string; score: number; status: string } }
  | { name: 'level_up'; params: { level: number; rank: string } }
  | { name: 'badge_unlocked'; params: { badgeId: string } }
  | { name: 'streak_extended'; params: { current: number } }
  | { name: 'streak_broken'; params: { previous: number } }
  | { name: 'leaderboard_viewed'; params: { period: string } }
  | { name: 'share_result'; params: { mode: string; status: string } }
  | { name: 'screen_view'; params: { screen: string } };

export type AnalyticsEventName = AnalyticsEvent['name'];

export interface AnalyticsTransport {
  logEvent(name: string, params: Record<string, unknown>): void | Promise<void>;
  setUserId(uid: string | null): void | Promise<void>;
  setUserProperties(props: Record<string, string>): void | Promise<void>;
}

/** Discards everything. Used in tests and when analytics are unavailable. */
export const noopTransport: AnalyticsTransport = {
  logEvent: () => {},
  setUserId: () => {},
  setUserProperties: () => {},
};

/** Prints to Metro. Handy while building funnels locally. */
export const consoleTransport: AnalyticsTransport = {
  logEvent: (name, params) => {
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${name}`, params);
  },
  setUserId: (uid) => {
    // eslint-disable-next-line no-console
    console.log('[analytics] setUserId', uid);
  },
  setUserProperties: (props) => {
    // eslint-disable-next-line no-console
    console.log('[analytics] setUserProperties', props);
  },
};

const MAX_BUFFER = 50;

let transport: AnalyticsTransport | null = null;
let buffer: { name: string; params: Record<string, unknown> }[] = [];

export function registerAnalyticsTransport(next: AnalyticsTransport): void {
  transport = next;
  const pending = buffer;
  buffer = [];
  for (const event of pending) {
    void transport.logEvent(event.name, event.params);
  }
}

export function track<E extends AnalyticsEvent>(name: E['name'], params: E['params']): void {
  const payload = params as Record<string, unknown>;
  if (!transport) {
    if (buffer.length < MAX_BUFFER) buffer.push({ name, params: payload });
    return;
  }
  try {
    void transport.logEvent(name, payload);
  } catch {
    // Analytics must never break a game.
  }
}

export function identify(uid: string | null): void {
  try {
    void transport?.setUserId(uid);
  } catch {
    /* ignore */
  }
}

/**
 * Segmentation properties. Keep the cardinality low — these become BigQuery
 * dimensions and Firebase caps the number of distinct user properties.
 */
export function setPlayerProperties(props: {
  level: number;
  streak: number;
  isAnonymous: boolean;
}): void {
  try {
    void transport?.setUserProperties({
      level_bucket: bucketLevel(props.level),
      streak_bucket: bucketStreak(props.streak),
      account_type: props.isAnonymous ? 'anonymous' : 'registered',
    });
  } catch {
    /* ignore */
  }
}

function bucketLevel(level: number): string {
  if (level >= 50) return '50';
  if (level >= 25) return '25-49';
  if (level >= 10) return '10-24';
  if (level >= 5) return '5-9';
  return '1-4';
}

function bucketStreak(streak: number): string {
  if (streak >= 30) return '30+';
  if (streak >= 7) return '7-29';
  if (streak >= 3) return '3-6';
  if (streak >= 1) return '1-2';
  return '0';
}
