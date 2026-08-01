import React, { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { getGameModule, getVariant } from '@/engine/registry';
import { getRenderer } from '@/games/renderers';
import { useGameSession } from '@/state/useGameSession';
import { Screen, Text } from '@/ui/components';
import { useTheme } from '@/ui/ThemeProvider';
import type { RootScreenProps } from '@/navigation/types';

type Props = RootScreenProps<'Game'>;

/**
 * Game host.
 *
 * Owns the session lifecycle and the chrome (title, quit, transition to the
 * result screen) and delegates the board itself to whichever renderer the
 * module declares. Nothing here knows the rules of the game being played.
 */
export function GameScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const params = route.params;

  const module = getGameModule(params.moduleId);
  const variant = getVariant(params.moduleId, params.variantId);
  const Board = getRenderer(module.renderer);

  const session = useGameSession({
    sessionId: params.sessionId,
    moduleId: params.moduleId,
    variantId: params.variantId,
    mode: params.mode,
    seed: params.seed,
    challengeId: params.challengeId ?? null,
  });

  const [finishing, setFinishing] = useState(false);
  const handledRef = useRef(false);

  const goToResult = useCallback(async () => {
    if (handledRef.current) return;
    handledRef.current = true;
    setFinishing(true);

    const result = session.getResult();
    const outcome = await session.finish();

    if (!result) {
      navigation.goBack();
      return;
    }

    navigation.replace('Result', {
      moduleId: result.moduleId,
      variantId: result.variantId,
      mode: result.mode,
      status: result.outcome.status,
      movesUsed: result.outcome.movesUsed,
      maxMoves: result.outcome.maxMoves,
      durationMs: result.outcome.durationMs,
      solution: result.solution,
      guesses: result.moves.map((move) => move.label),
      // The fallback must agree with the outcome. Hardcoding 'failed' here
      // produced a result screen that showed a win tick above "Not this time".
      score: outcome?.score ?? {
        total: 0,
        xp: 0,
        rating: result.outcome.status === 'won' ? 'solid' : 'failed',
        components: [],
        isPersonalBest: false,
      },
      events: outcome?.events ?? [],
      synced: outcome?.synced ?? false,
      rejection: outcome?.rejection ?? null,
    });
  }, [session, navigation]);

  const confirmQuit = useCallback(() => {
    if (session.isOver) {
      navigation.goBack();
      return;
    }

    Alert.alert(
      'Leave this game?',
      params.mode === 'daily'
        ? 'Your one attempt at today’s challenge will be recorded as unfinished.'
        : 'This game will be recorded as unfinished.',
      [
        { text: 'Keep playing', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            session.abandon();
            void goToResult();
          },
        },
      ],
    );
  }, [session, navigation, params.mode, goToResult]);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave game"
          onPress={confirmQuit}
          hitSlop={12}
        >
          <Text variant="heading" tone="muted">
            ✕
          </Text>
        </Pressable>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text variant="overline" tone="faint">
            {params.mode === 'daily' ? 'Daily Challenge' : module.title}
          </Text>
          <Text variant="caption" tone="muted">
            {variant.title}
          </Text>
        </View>

        {/* Balances the close button so the title stays optically centred. */}
        <View style={{ width: 22 }} />
      </View>

      <Board session={session} onFinished={() => void goToResult()} />

      {finishing ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: theme.colors.overlay,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="body" tone="inverse">
            Scoring…
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
