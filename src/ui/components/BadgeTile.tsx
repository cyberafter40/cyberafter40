import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { BadgeDefinition, BadgeTier } from '@/progress/badges';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

export interface BadgeTileProps {
  badge: BadgeDefinition;
  unlocked: boolean;
  unlockedAt?: number;
}

const TIER_COLORS: Record<BadgeTier, string> = {
  bronze: '#C08457',
  silver: '#A7B0BD',
  gold: '#E0B341',
  platinum: '#7FD8E8',
};

export function BadgeTile({ badge, unlocked, unlockedAt }: BadgeTileProps) {
  const theme = useTheme();
  const hidden = badge.secret && !unlocked;

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={
        unlocked
          ? `${badge.title}, unlocked. ${badge.description}`
          : hidden
            ? 'Hidden badge, not yet unlocked'
            : `${badge.title}, locked. ${badge.description}`
      }
      style={[
        styles.tile,
        {
          backgroundColor: theme.colors.surface,
          borderColor: unlocked ? TIER_COLORS[badge.tier] : theme.colors.border,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
          opacity: unlocked ? 1 : 0.55,
        },
      ]}
    >
      <Text style={{ fontSize: 30 }}>{hidden ? '❔' : badge.icon}</Text>
      <Text variant="caption" style={{ marginTop: theme.spacing.sm }} numberOfLines={1}>
        {hidden ? 'Hidden' : badge.title}
      </Text>
      <Text variant="caption" tone="faint" numberOfLines={2} style={{ marginTop: 2 }}>
        {hidden ? 'Keep playing to reveal' : badge.description}
      </Text>
      {unlocked && unlockedAt ? (
        <Text variant="caption" tone="faint" style={{ marginTop: theme.spacing.xs }}>
          {new Date(unlockedAt).toLocaleDateString()}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderWidth: 1, flexBasis: '47%', flexGrow: 1, minHeight: 148 },
});
