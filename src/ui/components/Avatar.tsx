import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { avatarFor } from '../theme';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

export interface AvatarProps {
  avatarId: number;
  size?: number;
  /** Level badge in the corner. Omitted on dense lists. */
  level?: number;
}

/**
 * Gradient avatars. No uploads means no image pipeline, no storage costs and —
 * more importantly — no user-generated content to moderate before launch.
 */
export function Avatar({ avatarId, size = 48, level }: AvatarProps) {
  const theme = useTheme();
  const avatar = avatarFor(avatarId);

  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={[avatar.from, avatar.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: size * 0.36, color: '#FFFFFF' }}>{avatar.glyph}</Text>
      </LinearGradient>

      {typeof level === 'number' ? (
        <View
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            minWidth: size * 0.42,
            height: size * 0.42,
            paddingHorizontal: 4,
            borderRadius: size * 0.21,
            backgroundColor: theme.colors.surfaceRaised,
            borderWidth: 2,
            borderColor: theme.colors.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: size * 0.22, fontWeight: '700', color: theme.colors.text }}>
            {level}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
