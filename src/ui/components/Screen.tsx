import React, { type ReactNode } from 'react';
import { ScrollView, StatusBar, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeProvider';

export interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView. Off for the game board, which must not scroll. */
  scroll?: boolean;
  /** Remove default horizontal padding — for edge-to-edge lists. */
  flush?: boolean;
  style?: ViewStyle;
  footer?: ReactNode;
}

/**
 * Standard page frame: background colour, safe-area insets, consistent gutters
 * and an optional pinned footer for primary actions.
 */
export function Screen({ children, scroll = false, flush = false, style, footer }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const padding: ViewStyle = {
    paddingHorizontal: flush ? 0 : theme.spacing.xl,
    paddingTop: insets.top + theme.spacing.md,
  };

  const body = scroll ? (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[
        padding,
        { paddingBottom: insets.bottom + theme.spacing.xxl },
        style,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, padding, style]}>{children}</View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.bg }]}>
      <StatusBar barStyle={theme.scheme === 'dark' ? 'light-content' : 'dark-content'} />
      {body}
      {footer ? (
        <View
          style={{
            paddingHorizontal: theme.spacing.xl,
            paddingBottom: insets.bottom + theme.spacing.lg,
            paddingTop: theme.spacing.md,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
