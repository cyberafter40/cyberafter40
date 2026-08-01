import React, { type ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  /** Raised cards use the accent border to mark the primary call to action. */
  highlighted?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Card({
  children,
  onPress,
  highlighted = false,
  padded = true,
  style,
  accessibilityLabel,
}: CardProps) {
  const theme = useTheme();

  const base: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: highlighted ? theme.colors.accent : theme.colors.border,
    padding: padded ? theme.spacing.xl : 0,
    ...theme.elevation(highlighted ? 2 : 1),
  };

  if (!onPress) return <View style={[base, style]}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}
