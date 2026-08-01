import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';
import type { typography } from '../theme';

export type TextVariant = keyof typeof typography;
export type TextTone = 'default' | 'muted' | 'faint' | 'accent' | 'positive' | 'negative' | 'inverse';

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
  center?: boolean;
}

/**
 * The only text primitive in the app. Routing every label through it is what
 * keeps type scale and colour usage consistent as the surface area grows.
 */
export function Text({
  variant = 'body',
  tone = 'default',
  center = false,
  style,
  ...rest
}: AppTextProps) {
  const theme = useTheme();

  const toneColor: Record<TextTone, string> = {
    default: theme.colors.text,
    muted: theme.colors.textMuted,
    faint: theme.colors.textFaint,
    accent: theme.colors.accent,
    positive: theme.colors.positive,
    negative: theme.colors.negative,
    inverse: theme.colors.accentText,
  };

  const base = theme.typography[variant] as TextStyle;

  return (
    <RNText
      {...rest}
      style={[base, { color: toneColor[tone] }, center && { textAlign: 'center' }, style]}
    />
  );
}
