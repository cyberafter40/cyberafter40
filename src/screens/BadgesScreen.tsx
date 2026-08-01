import React from 'react';
import { View } from 'react-native';
import { BADGES } from '@/progress/badges';
import { useProfile } from '@/state/ProfileContext';
import { BadgeTile, Screen, Text } from '@/ui/components';
import { useTheme } from '@/ui/ThemeProvider';

export function BadgesScreen() {
  const theme = useTheme();
  const { profile } = useProfile();
  const owned = profile?.badges ?? {};
  const unlockedCount = Object.keys(owned).length;

  // Unlocked first, then visible locked badges, then secrets — so the wall
  // reads as an achievement record rather than a to-do list.
  const ordered = [...BADGES].sort((a, b) => {
    const aOwned = owned[a.id] ? 0 : a.secret ? 2 : 1;
    const bOwned = owned[b.id] ? 0 : b.secret ? 2 : 1;
    return aOwned - bOwned;
  });

  return (
    <Screen scroll>
      <Text variant="title">Badges</Text>
      <Text variant="caption" tone="muted" style={{ marginTop: theme.spacing.xs }}>
        {unlockedCount} of {BADGES.length} unlocked
      </Text>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.md,
          marginTop: theme.spacing.xl,
        }}
      >
        {ordered.map((badge) => (
          <BadgeTile
            key={badge.id}
            badge={badge}
            unlocked={!!owned[badge.id]}
            unlockedAt={owned[badge.id]?.unlockedAt}
          />
        ))}
      </View>
    </Screen>
  );
}
