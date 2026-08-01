import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={{ alignItems: 'center', paddingVertical: theme.spacing.xxxl }}>
      <Text style={{ fontSize: 40 }}>{icon}</Text>
      <Text variant="heading" center style={{ marginTop: theme.spacing.lg }}>
        {title}
      </Text>
      <Text
        variant="body"
        tone="muted"
        center
        style={{ marginTop: theme.spacing.sm, maxWidth: 300 }}
      >
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          fullWidth={false}
          style={{ marginTop: theme.spacing.xl }}
        />
      ) : null}
    </View>
  );
}
