import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import type { GameRendererProps } from '@/games/renderers';
import { ProgressBar, Text } from '@/ui/components';
import { errorFeedback, successFeedback, tapFeedback } from '@/ui/haptics';
import { useTheme } from '@/ui/ThemeProvider';
import type { MemoryGridFeedback, MemoryGridState } from './engine';

type Phase = 'watch' | 'recall' | 'done';

/**
 * The play surface for Memory Grid.
 *
 * The reveal is a presentation concern, not a rule, so it lives here rather
 * than in the engine: the engine only knows about taps. That keeps it pure and
 * replayable, and means the reveal can be re-timed, animated differently or
 * skipped for accessibility without touching game logic.
 */
export function MemoryGridBoard({ session, onFinished }: GameRendererProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const state = session.state<MemoryGridState>();
  const { config, sequence } = state;

  const [phase, setPhase] = useState<Phase>('watch');
  const [litTile, setLitTile] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ tile: number; correct: boolean } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const tileSize = useMemo(() => {
    const gutters = theme.spacing.sm * (config.size + 1);
    const available = Math.min(width, 420) - theme.spacing.xl * 2;
    return Math.floor((available - gutters) / config.size);
  }, [width, config.size, theme.spacing]);

  // Play the sequence once, then hand control to the player.
  useEffect(() => {
    const schedule = (fn: () => void, delay: number) => {
      timers.current.push(setTimeout(fn, delay));
    };

    let cursor = 500;
    sequence.forEach((tile) => {
      schedule(() => setLitTile(tile), cursor);
      schedule(() => setLitTile(null), cursor + config.revealMs);
      // A dark gap between tiles is what makes two of the same readable.
      cursor += config.revealMs + 220;
    });
    schedule(() => setPhase('recall'), cursor);

    const scheduled = timers.current;
    return () => {
      scheduled.forEach(clearTimeout);
      timers.current = [];
    };
  }, [sequence, config.revealMs]);

  const tap = useCallback(
    (tile: number) => {
      if (phase !== 'recall') return;

      tapFeedback();
      const outcome = session.submitMove({ tile });
      if (!outcome.accepted) return;

      const feedback = outcome.feedback as MemoryGridFeedback;
      setFlash({ tile, correct: feedback.correct });
      timers.current.push(setTimeout(() => setFlash(null), 260));

      if (!feedback.correct) errorFeedback();
      if (feedback.solved) successFeedback();

      if (outcome.terminal) {
        setPhase('done');
        timers.current.push(setTimeout(onFinished, 620));
      }
    },
    [phase, session, onFinished],
  );

  const recalled = state.entered.length;
  const mistakesLeft = Math.max(0, config.maxMistakes - state.mistakes);

  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: theme.spacing.xl }}>
        <Text variant="heading" center>
          {phase === 'watch' ? 'Watch' : phase === 'recall' ? 'Repeat it' : 'Done'}
        </Text>
        <Text variant="caption" tone="muted" center style={{ marginTop: theme.spacing.xs }}>
          {phase === 'watch'
            ? `${config.sequenceLength} tiles, in order`
            : `${recalled} of ${config.sequenceLength} · ${mistakesLeft} mistake${
                mistakesLeft === 1 ? '' : 's'
              } left`}
        </Text>

        <ProgressBar
          value={recalled / config.sequenceLength}
          animate={false}
          style={{ width: 180, marginTop: theme.spacing.lg }}
        />
      </View>

      <View style={{ alignSelf: 'center' }}>
        {Array.from({ length: config.size }).map((_, row) => (
          <View key={row} style={{ flexDirection: 'row' }}>
            {Array.from({ length: config.size }).map((__, column) => {
              const tile = row * config.size + column;
              const isLit = litTile === tile;
              const isFlashing = flash?.tile === tile;

              const background = isLit
                ? theme.colors.accent
                : isFlashing
                  ? flash.correct
                    ? theme.colors.positiveSoft
                    : theme.colors.negativeSoft
                  : theme.colors.surfaceRaised;

              const border = isFlashing
                ? flash.correct
                  ? theme.colors.positive
                  : theme.colors.negative
                : theme.colors.border;

              return (
                <Pressable
                  key={tile}
                  accessibilityRole="button"
                  accessibilityLabel={`Tile ${tile + 1}`}
                  accessibilityState={{ disabled: phase !== 'recall' }}
                  disabled={phase !== 'recall'}
                  onPress={() => tap(tile)}
                  style={({ pressed }) => ({
                    width: tileSize,
                    height: tileSize,
                    margin: theme.spacing.sm / 2,
                    borderRadius: theme.radius.lg,
                    backgroundColor: background,
                    borderWidth: 2,
                    borderColor: border,
                    opacity: pressed && phase === 'recall' ? 0.75 : 1,
                  })}
                />
              );
            })}
          </View>
        ))}
      </View>

      <Text
        variant="caption"
        tone="faint"
        center
        style={{ marginTop: theme.spacing.xl, height: 20 }}
      >
        {phase === 'watch' ? '' : session.errorMessage ?? 'Tap the tiles in the order they lit up.'}
      </Text>
    </View>
  );
}
