import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { describeAuthError } from '@/services/auth';
import { useAuth } from '@/state/AuthContext';
import { Button, Screen, Text } from '@/ui/components';
import { useTheme } from '@/ui/ThemeProvider';
import { generateDisplayName, validateDisplayName } from '@/utils/names';
import type { RootScreenProps } from '@/navigation/types';

type Props = RootScreenProps<'Auth'>;

/**
 * Sign in / create account.
 *
 * Reached voluntarily, never as a gate. The copy is explicit that an account is
 * about *keeping* progress across devices, because the player already has
 * progress by the time they see this screen.
 */
export function AuthScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { user, signUp, signIn, resetPassword } = useAuth();

  const [mode, setMode] = useState<'sign_in' | 'sign_up'>(route.params?.intent ?? 'sign_up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(() =>
    generateDisplayName(user?.uid ?? 'guest'),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignUp = mode === 'sign_up';

  const submit = async () => {
    setError(null);
    setNotice(null);

    if (isSignUp) {
      const nameError = validateDisplayName(displayName);
      if (nameError) {
        setError(nameError);
        return;
      }
    }

    setBusy(true);
    try {
      if (isSignUp) await signUp(email.trim(), password, displayName.trim());
      else await signIn(email.trim(), password);
      navigation.goBack();
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    height: 52,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    fontSize: 16,
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text variant="title" style={{ marginTop: theme.spacing.xl }}>
          {isSignUp ? 'Keep your progress' : 'Welcome back'}
        </Text>
        <Text variant="body" tone="muted" style={{ marginTop: theme.spacing.sm }}>
          {isSignUp
            ? 'Your streak, XP and badges stay on this device unless you create an account. Everything you have already earned carries over.'
            : 'Sign in to restore your streak, XP and badges.'}
        </Text>

        {isSignUp ? (
          <>
            <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xl }}>
              Display name
            </Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Shown on leaderboards"
              placeholderTextColor={theme.colors.textFaint}
              autoCapitalize="words"
              maxLength={20}
              style={inputStyle}
              accessibilityLabel="Display name"
            />
          </>
        ) : null}

        <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xl }}>
          Email
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={theme.colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          style={inputStyle}
          accessibilityLabel="Email"
        />

        <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xl }}>
          Password
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          placeholderTextColor={theme.colors.textFaint}
          secureTextEntry
          autoCapitalize="none"
          textContentType={isSignUp ? 'newPassword' : 'password'}
          style={inputStyle}
          accessibilityLabel="Password"
        />

        {error ? (
          <Text variant="caption" tone="negative" style={{ marginTop: theme.spacing.md }}>
            {error}
          </Text>
        ) : null}
        {notice ? (
          <Text variant="caption" tone="accent" style={{ marginTop: theme.spacing.md }}>
            {notice}
          </Text>
        ) : null}

        <Button
          label={isSignUp ? 'Create account' : 'Sign in'}
          onPress={() => void submit()}
          loading={busy}
          disabled={email.trim().length === 0 || password.length === 0}
          style={{ marginTop: theme.spacing.xl }}
        />

        <Button
          label={isSignUp ? 'I already have an account' : 'Create an account instead'}
          variant="ghost"
          onPress={() => {
            setError(null);
            setMode(isSignUp ? 'sign_in' : 'sign_up');
          }}
          style={{ marginTop: theme.spacing.sm }}
        />

        {!isSignUp ? (
          <Button
            label="Forgot password"
            variant="ghost"
            onPress={() => {
              if (email.trim().length === 0) {
                setError('Enter your email first.');
                return;
              }
              void resetPassword(email.trim())
                .then(() => setNotice('Check your inbox for a reset link.'))
                .catch((err) => setError(describeAuthError(err)));
            }}
          />
        ) : null}

        <View style={{ height: theme.spacing.xxl }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
