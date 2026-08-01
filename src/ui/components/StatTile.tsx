import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

export interface StatTileProps {
  label: string;
  value: string;
  /** Small supporting line, e.g. "best 9". */
  hint?: string;
  accent?: boolean;
  style?: ViewStyle;
}

/** Compact metric block used across the profile and result screens. */
export function StatTile({ label, value, hint, accent = false, style }: StatTileProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}
      style={[
        styles.tile,
        {
          backgroundColor: accent ? theme.colors.accentSoft : theme.colors.surface,
          borderColor: accent ? 'transparent' : theme.colors.border,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
        },
        style,
      ]}
    >
      <Text variant="overline" tone="faint">
        {label}
      </Text>
      <Text
        variant="title"
        tone={accent ? 'accent' : 'default'}
        style={{ marginTop: theme.spacing.xs }}
      >
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderWidth: 1, minWidth: 0, flexGrow: 1, flexBasis: '46%' },
});
