import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { tapFeedback } from '../haptics';
import { Text } from './Text';

export interface KeypadProps {
  onDigit: (digit: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
  canDelete: boolean;
  disabled?: boolean;
  submitLabel?: string;
  /** Digits already ruled out — dimmed as a memory aid, still tappable. */
  eliminated?: ReadonlySet<string>;
}

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

/**
 * The number pad.
 *
 * A phone keyboard would work, but a bespoke pad keeps the board visible, gives
 * us the eliminated-digit affordance, and makes the game feel like an object
 * rather than a form. Keys are 64pt tall with generous gutters — thumb-first.
 */
export function Keypad({
  onDigit,
  onDelete,
  onSubmit,
  canSubmit,
  canDelete,
  disabled = false,
  submitLabel = 'Check',
  eliminated,
}: KeypadProps) {
  const theme = useTheme();

  const key = (
    label: string,
    onPress: () => void,
    opts: { flex?: number; tone?: 'default' | 'accent' | 'muted'; enabled?: boolean } = {},
  ) => {
    const enabled = (opts.enabled ?? true) && !disabled;
    const tone = opts.tone ?? 'default';
    const dimmed = eliminated?.has(label) ?? false;

    const background =
      tone === 'accent'
        ? theme.colors.accent
        : tone === 'muted'
          ? theme.colors.neutralPill
          : theme.colors.surfaceRaised;

    const color =
      tone === 'accent'
        ? theme.colors.accentText
        : dimmed
          ? theme.colors.textFaint
          : theme.colors.text;

    return (
      <Pressable
        key={label}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !enabled }}
        disabled={!enabled}
        onPress={() => {
          tapFeedback();
          onPress();
        }}
        style={({ pressed }) => [
          styles.key,
          {
            flex: opts.flex ?? 1,
            backgroundColor: background,
            borderRadius: theme.radius.md,
            marginHorizontal: theme.spacing.xs + 1,
            opacity: !enabled ? 0.35 : pressed ? 0.8 : 1,
            borderWidth: tone === 'default' ? 1 : 0,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text variant="heading" style={{ color }}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View>
      {ROWS.map((row) => (
        <View key={row.join('')} style={[styles.row, { marginBottom: theme.spacing.sm }]}>
          {row.map((digit) => key(digit, () => onDigit(digit)))}
        </View>
      ))}

      <View style={[styles.row, { marginBottom: theme.spacing.sm }]}>
        {key('⌫', onDelete, { tone: 'muted', enabled: canDelete })}
        {key('0', () => onDigit('0'))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
          accessibilityState={{ disabled: !canSubmit || disabled }}
          disabled={!canSubmit || disabled}
          onPress={() => {
            tapFeedback();
            onSubmit();
          }}
          style={({ pressed }) => [
            styles.key,
            {
              flex: 1,
              backgroundColor: theme.colors.accent,
              borderRadius: theme.radius.md,
              marginHorizontal: theme.spacing.xs + 1,
              opacity: !canSubmit || disabled ? 0.35 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text variant="caption" style={{ color: theme.colors.accentText }}>
            {submitLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  key: { height: 62, alignItems: 'center', justifyContent: 'center' },
});
