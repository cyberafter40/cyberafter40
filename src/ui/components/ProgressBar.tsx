import React, { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../ThemeProvider';

export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  height?: number;
  color?: string;
  trackColor?: string;
  style?: ViewStyle;
  animate?: boolean;
  accessibilityLabel?: string;
}

export function ProgressBar({
  value,
  height = 8,
  color,
  trackColor,
  style,
  animate = true,
  accessibilityLabel,
}: ProgressBarProps) {
  const theme = useTheme();
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const progress = useSharedValue(animate ? 0 : clamped);

  useEffect(() => {
    progress.value = animate
      ? withTiming(clamped, { duration: theme.motion.slow })
      : clamped;
  }, [clamped, animate, progress, theme.motion.slow]);

  const fill = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[
        {
          height,
          borderRadius: theme.radius.pill,
          backgroundColor: trackColor ?? theme.colors.neutralPill,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            borderRadius: theme.radius.pill,
            backgroundColor: color ?? theme.colors.accent,
          },
          fill,
        ]}
      />
    </View>
  );
}
