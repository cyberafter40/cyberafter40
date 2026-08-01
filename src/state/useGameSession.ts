import { useCallback, useMemo, useRef, useState } from 'react';
import {
  GameSession,
  type GameResult,
  type MoveRecord,
  type SubmitOutcome,
} from '@/engine/session';
import type { GameMode, GameStatus } from '@/engine/types';
import type { TranslationKey, TranslationParams } from '@/i18n/types';
import { track } from '@/services/analytics';
import { submitResult, type SubmissionOutcome } from '@/services/submission';
import { useProfile } from './ProfileContext';

export interface UseGameSessionInput {
  sessionId: string;
  moduleId: string;
  variantId: string;
  mode: GameMode;
  seed: string;
  challengeId?: string | null;
}

export interface UseGameSessionValue {
  status: GameStatus;
  history: readonly MoveRecord[];
  /** Increments whenever a move is rejected — drives the shake animation. */
  shakeToken: number;
  /**
   * Why the last move was rejected, as a translation key plus its parameters.
   * A key rather than a sentence: the engine that produced it is pure and is
   * replayed on the server, so it cannot know the player's language.
   */
  error: MoveError | null;
  isOver: boolean;
  state: <T>() => T;
  /**
   * Applies a move and returns what happened *right now* — including whether
   * the game just ended. Renderers must use this return value rather than
   * re-reading `isOver`, which is a render-time snapshot and will still say
   * `false` immediately after the winning move.
   */
  submitMove: (move: unknown) => SubmitOutcome;
  abandon: () => void;
  /** Scores, persists and returns the finished game. Safe to call once. */
  finish: () => Promise<SubmissionOutcome | null>;
  /**
   * The finished game, or null while it is still running.
   *
   * A function rather than a snapshot on purpose: the board's completion
   * callback is captured *before* the winning move re-renders, so a snapshot
   * taken at render time would still read `null` by the time it is used.
   */
  getResult: () => GameResult | null;
}

/**
 * React binding for a `GameSession`.
 *
 * The session itself lives in a ref because it is a mutable state machine, not
 * React state; the hook exposes a small immutable view of it and bumps a
 * version counter to trigger re-renders. That keeps the engine free of React
 * concerns and means any future game module gets this plumbing for free.
 */
export interface MoveError {
  key: TranslationKey;
  params?: TranslationParams;
}

export function useGameSession(input: UseGameSessionInput): UseGameSessionValue {
  const { profile, applyLocalProfile } = useProfile();

  const sessionRef = useRef<GameSession | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = new GameSession({
      sessionId: input.sessionId,
      moduleId: input.moduleId,
      variantId: input.variantId,
      mode: input.mode,
      seed: input.seed,
      challengeId: input.challengeId ?? null,
    });

    track('game_start', {
      moduleId: input.moduleId,
      variantId: input.variantId,
      mode: input.mode,
      difficulty: sessionRef.current.difficulty,
    });
  }

  const session = sessionRef.current;
  const [version, setVersion] = useState(0);
  const [shakeToken, setShakeToken] = useState(0);
  const [error, setError] = useState<MoveError | null>(null);
  const submittedRef = useRef(false);

  const submitMove = useCallback(
    (move: unknown): SubmitOutcome => {
      const outcome = session.submit(move);

      if (!outcome.accepted) {
        setShakeToken((token) => token + 1);
        setError({
          key: outcome.validation.messageKey ?? 'numberLogic.errorRejected',
          ...(outcome.validation.messageParams
            ? { params: outcome.validation.messageParams }
            : {}),
        });
        return outcome;
      }

      setError(null);
      setVersion((v) => v + 1);

      track('guess_submitted', {
        moduleId: session.module.id,
        variantId: session.variantId,
        attempt: session.movesUsed,
        score: (outcome.feedback as { score?: number } | undefined)?.score ?? 0,
      });

      return outcome;
    },
    [session],
  );

  const abandon = useCallback(() => {
    session.abandon();
    setVersion((v) => v + 1);
  }, [session]);

  const finish = useCallback(async (): Promise<SubmissionOutcome | null> => {
    if (!session.isOver || submittedRef.current) return null;
    submittedRef.current = true;

    const result = session.toResult();

    // `profile` may still be null on a cold start: the home screen renders
    // before auth resolves, so a quick tap can begin a game first. The
    // submission does not depend on it — the backend reads its own copy — and
    // scoring falls back to a neutral baseline, so the player still sees a real
    // result instead of a zeroed one.
    const outcome = await submitResult({ result, profile });
    if (outcome.profile) applyLocalProfile(outcome.profile);
    return outcome;
  }, [session, profile, applyLocalProfile]);

  return useMemo<UseGameSessionValue>(
    () => ({
      status: session.status,
      history: session.history,
      shakeToken,
      error,
      isOver: session.isOver,
      state: <T,>() => session.getState<T>(),
      submitMove,
      abandon,
      finish,
      getResult: () => (session.isOver ? session.toResult() : null),
    }),
    // `version` is the explicit invalidation signal for the mutable session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, version, shakeToken, error, submitMove, abandon, finish],
  );
}
