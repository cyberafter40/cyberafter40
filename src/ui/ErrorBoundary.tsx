import React, { Component, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { t } from '@/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence.
 *
 * A crashed render in a daily-habit app is worse than a bug — it breaks the
 * streak the player has been protecting. This catches the render, shows
 * something honest, and offers a reset that remounts the tree without losing
 * any persisted progress.
 *
 * Styling is inline and dependency-free on purpose: this must render even if
 * the theme provider is the thing that failed.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    // Wire this to Crashlytics/Sentry in production builds.
    // eslint-disable-next-line no-console
    console.error('[MindCode] render error', error);
  }

  override render() {
    if (!this.state.error) return this.props.children;

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0E1116',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <Text style={{ fontSize: 40, marginBottom: 16 }}>😕</Text>
        <Text
          style={{ color: '#F3F5F8', fontSize: 20, fontWeight: '700', textAlign: 'center' }}
        >
          {t('errorBoundary.title')}
        </Text>
        <Text
          style={{
            color: '#9AA4B2',
            fontSize: 15,
            textAlign: 'center',
            marginTop: 8,
            lineHeight: 22,
          }}
        >
          {t('errorBoundary.body')}
        </Text>
        <Text
          accessibilityRole="button"
          onPress={() => this.setState({ error: null })}
          style={{
            color: '#FFFFFF',
            backgroundColor: '#7C6BFF',
            fontSize: 16,
            fontWeight: '700',
            overflow: 'hidden',
            borderRadius: 18,
            paddingVertical: 14,
            paddingHorizontal: 28,
            marginTop: 28,
          }}
        >
          {t('errorBoundary.reload')}
        </Text>
      </View>
    );
  }
}
