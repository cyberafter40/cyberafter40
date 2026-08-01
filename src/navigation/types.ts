import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { GameMode } from '@/engine/types';
import type { ProgressEvent } from '@/progress/types';
import type { ScoreBreakdown } from '@/scoring/types';

/**
 * Navigation contracts.
 *
 * Route params are kept strictly JSON-serialisable — React Navigation warns
 * about anything else, and it also means a deep link or a state restoration
 * after an OS kill can rebuild any screen exactly.
 */

export interface GameRouteParams {
  sessionId: string;
  moduleId: string;
  variantId: string;
  mode: GameMode;
  seed: string;
  challengeId?: string | null;
}

export interface ResultRouteParams {
  moduleId: string;
  variantId: string;
  mode: GameMode;
  status: 'won' | 'lost' | 'abandoned';
  movesUsed: number;
  maxMoves: number;
  durationMs: number;
  solution: string;
  guesses: string[];
  score: ScoreBreakdown;
  events: ProgressEvent[];
  /** False when the result is queued for later sync. */
  synced: boolean;
}

export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: undefined;
  Game: GameRouteParams;
  Result: ResultRouteParams;
  Auth: { intent: 'sign_in' | 'sign_up' } | undefined;
  Settings: undefined;
  Badges: undefined;
  HowToPlay: { variantId?: string } | undefined;
};

export type TabParamList = {
  Home: undefined;
  Leaderboard: undefined;
  Profile: undefined;
};

/**
 * Tab screens live inside the root stack, so they need both navigators' props
 * to navigate to Game/Result without casting.
 */
export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
