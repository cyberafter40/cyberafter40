import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

export interface GuessRowProps {
  index: number;
  guess: string;
  /** Policy-formatted score, e.g. `+2`, `0`, `−2`. */
  display: string;
  score: number;
  /** Candidates still consistent with the feedback, when measurable. */
  candidatesRemaining?: number | null;
  animateIn?: boolean;
}

/**
 * One row of guess history.
 *
 * The score pill is the only coloured element: green when the guess gained
 * position, rose when it revealed misplacement, neutral grey at zero. Reading
 * the column top to bottom should feel like reading your own reasoning back.
 */
export function GuessRow({
  index,
  guess,
  display,
  score,
  candidatesRemaining,
  animateIn = false,
}: GuessRowProps) {
  const theme = useTheme();

  const pill =
    score > 0
      ? { bg: theme.colors.positiveSoft, fg: theme.colors.positive }
      : score < 0
        ? { bg: theme.colors.negativeSoft, fg: theme.colors.negative }
        : { bg: theme.colors.neutralPill, fg: theme.colors.textMuted };

  const rowStyle: ViewStyle[] = [
    styles.row,
    {
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
  ];

  const accessibilityLabel = `Guess ${index + 1}, ${guess
    .split('')
    .join(' ')}, result ${display}`;

  const content = (
    <>
      <Text variant="caption" tone="faint" style={styles.index}>
        {index + 1}
      </Text>

      <Text style={[theme.typography.mono, { color: theme.colors.text, letterSpacing: 6 }]}>
        {guess}
      </Text>

      <View style={styles.spacer} />

      {typeof candidatesRemaining === 'number' ? (
        <Text variant="caption" tone="faint" style={{ marginRight: theme.spacing.md }}>
          {candidatesRemaining} left
        </Text>
      ) : null}

      <View style={[styles.pill, { backgroundColor: pill.bg, borderRadius: theme.radius.pill }]}>
        <Text variant="bodyStrong" style={{ color: pill.fg }}>
          {display}
        </Text>
      </View>
    </>
  );

  // Only the newest row animates; re-animating the whole list on every guess
  // would turn a calm board into a slot machine.
  if (animateIn) {
    return (
      <Animated.View
        entering={FadeInDown.duration(240).springify().damping(18)}
        style={rowStyle}
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </Animated.View>
    );
  }

  return (
    <View style={rowStyle} accessibilityRole="text" accessibilityLabel={accessibilityLabel}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  index: { width: 20 },
  spacer: { flex: 1 },
  pill: { minWidth: 52, paddingVertical: 4, paddingHorizontal: 12, alignItems: 'center' },
});
