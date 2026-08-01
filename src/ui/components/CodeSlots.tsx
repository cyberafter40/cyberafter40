import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

export interface CodeSlotsProps {
  /** Digits entered so far, left to right. */
  value: string;
  length: number;
  /** Increment to trigger the "invalid entry" shake. */
  shakeToken?: number;
  /** Reveals the answer with a solved treatment. */
  solved?: boolean;
  size?: 'regular' | 'compact';
}

/**
 * The hero element: the hidden code's slots.
 *
 * Empty slots are outlined rather than filled so the row reads as a question,
 * not a form field. The filled state uses the accent border only — colour is
 * saved for the feedback score, which is the part that carries information.
 */
export function CodeSlots({
  value,
  length,
  shakeToken = 0,
  solved = false,
  size = 'regular',
}: CodeSlotsProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (shakeToken === 0) return;
    offset.value = withSequence(
      withTiming(-8, { duration: 45 }),
      withTiming(8, { duration: 60 }),
      withTiming(-5, { duration: 55 }),
      withTiming(0, { duration: 55 }),
    );
  }, [shakeToken, offset]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const slotSize = size === 'regular' ? 68 : 48;
  const fontSize = size === 'regular' ? 34 : 24;

  return (
    <Animated.View
      style={[styles.row, animatedStyle]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={
        value.length === 0
          ? t('a11y.emptyCode', { digits: length })
          : t('a11y.enteredCode', { digits: value.split('').join(' ') })
      }
    >
      {Array.from({ length }).map((_, index) => {
        const digit = value[index];
        const filled = digit !== undefined;

        return (
          <View
            key={index}
            style={[
              styles.slot,
              {
                width: slotSize,
                height: slotSize + 8,
                borderRadius: theme.radius.lg,
                borderWidth: 2,
                borderColor: solved
                  ? theme.colors.positive
                  : filled
                    ? theme.colors.accent
                    : theme.colors.border,
                backgroundColor: solved
                  ? theme.colors.positiveSoft
                  : filled
                    ? theme.colors.surfaceRaised
                    : 'transparent',
                marginHorizontal: theme.spacing.xs + 2,
              },
            ]}
          >
            <Text
              style={{
                fontSize,
                fontWeight: '700',
                color: solved ? theme.colors.positive : theme.colors.text,
              }}
            >
              {digit ?? ''}
            </Text>
          </View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  slot: { alignItems: 'center', justifyContent: 'center' },
});
