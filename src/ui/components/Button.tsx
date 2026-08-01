import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../ThemeProvider';
import { tapFeedback } from '../haptics';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Leading glyph — emoji or single character. */
  icon?: string;
  fullWidth?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

/**
 * The app's only button. A single 56pt-tall shape with four tones keeps the
 * interface calm and every tap target comfortably above the 44pt minimum.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  fullWidth = true,
  style,
  accessibilityHint,
}: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;

  const tones: Record<ButtonVariant, { bg: string; border: string; text: string }> = {
    primary: { bg: theme.colors.accent, border: 'transparent', text: theme.colors.accentText },
    secondary: {
      bg: theme.colors.surfaceRaised,
      border: theme.colors.border,
      text: theme.colors.text,
    },
    ghost: { bg: 'transparent', border: 'transparent', text: theme.colors.textMuted },
    danger: {
      bg: theme.colors.negativeSoft,
      border: 'transparent',
      text: theme.colors.negative,
    },
  };
  const tone = tones[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityHint={accessibilityHint}
      disabled={inactive}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: tone.bg,
          borderColor: tone.border,
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth * 2 : 0,
          borderRadius: theme.radius.lg,
          opacity: inactive ? 0.45 : pressed ? 0.86 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          paddingHorizontal: fullWidth ? theme.spacing.lg : theme.spacing.xl,
          transform: [{ scale: pressed && !inactive ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone.text} />
      ) : (
        <View style={styles.row}>
          {icon ? (
            <Text variant="bodyStrong" style={{ color: tone.text, marginRight: 8 }}>
              {icon}
            </Text>
          ) : null}
          <Text variant="bodyStrong" style={{ color: tone.text }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
});
