import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { describeAuthError } from '@/services/auth';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { TranslationKey, TranslationParams } from '@/i18n/types';
import { useAuth } from '@/state/AuthContext';
import { Button, Screen, Text } from '@/ui/components';
import { useTheme } from '@/ui/ThemeProvider';
import { generateDisplayName, validateDisplayName } from '@/utils/names';
import type { RootScreenProps } from '@/navigation/types';

type Props = RootScreenProps<'Auth'>;

interface Message {
  key: TranslationKey;
  params?: TranslationParams;
}

/**
 * Sign in / create account.
 *
 * Reached voluntarily, never as a gate. The copy is explicit that an account is
 * about *keeping* progress across devices, because the player already has
 * progress by the time they see this screen.
 */
export function AuthScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { user, signUp, signIn, resetPassword } = useAuth();

  const [mode, setMode] = useState<'sign_in' | 'sign_up'>(route.params?.intent ?? 'sign_up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(() =>
    generateDisplayName(user?.uid ?? 'guest'),
  );
  const [busy, setBusy] = useState(false);
  // Keys, not sentences: the auth service and the name validator both report a
  // translation key, and the screen is the only layer that knows the language.
  const [error, setError] = useState<Message | null>(null);
  const [notice, setNotice] = useState<TranslationKey | null>(null);

  const isSignUp = mode === 'sign_up';

  const submit = async () => {
    setError(null);
    setNotice(null);

    if (isSignUp) {
      const nameError = validateDisplayName(displayName);
      if (nameError) {
        setError(nameError.params ? { key: nameError.key, params: nameError.params } : { key: nameError.key });
        return;
      }
    }

    setBusy(true);
    try {
      if (isSignUp) await signUp(email.trim(), password, displayName.trim());
      else await signIn(email.trim(), password);
      navigation.goBack();
    } catch (err) {
      setError({ key: describeAuthError(err) });
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
          {isSignUp ? t('auth.signUpTitle') : t('auth.signInTitle')}
        </Text>
        <Text variant="body" tone="muted" style={{ marginTop: theme.spacing.sm }}>
          {isSignUp ? t('auth.signUpBody') : t('auth.signInBody')}
        </Text>

        {isSignUp ? (
          <>
            <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xl }}>
              {t('auth.displayName')}
            </Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t('auth.displayNamePlaceholder')}
              placeholderTextColor={theme.colors.textFaint}
              autoCapitalize="words"
              maxLength={20}
              style={inputStyle}
              accessibilityLabel={t('auth.displayName')}
            />
          </>
        ) : null}

        <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xl }}>
          {t('auth.email')}
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
          accessibilityLabel={t('auth.email')}
        />

        <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xl }}>
          {t('auth.password')}
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.passwordPlaceholder')}
          placeholderTextColor={theme.colors.textFaint}
          secureTextEntry
          autoCapitalize="none"
          textContentType={isSignUp ? 'newPassword' : 'password'}
          style={inputStyle}
          accessibilityLabel={t('auth.password')}
        />

        {error ? (
          <Text variant="caption" tone="negative" style={{ marginTop: theme.spacing.md }}>
            {t(error.key, error.params)}
          </Text>
        ) : null}
        {notice ? (
          <Text variant="caption" tone="accent" style={{ marginTop: theme.spacing.md }}>
            {t(notice)}
          </Text>
        ) : null}

        <Button
          label={isSignUp ? t('auth.createAccount') : t('auth.signIn')}
          onPress={() => void submit()}
          loading={busy}
          disabled={email.trim().length === 0 || password.length === 0}
          style={{ marginTop: theme.spacing.xl }}
        />

        <Button
          label={isSignUp ? t('auth.haveAccount') : t('auth.noAccount')}
          variant="ghost"
          onPress={() => {
            setError(null);
            setMode(isSignUp ? 'sign_in' : 'sign_up');
          }}
          style={{ marginTop: theme.spacing.sm }}
        />

        {!isSignUp ? (
          <Button
            label={t('auth.forgotPassword')}
            variant="ghost"
            onPress={() => {
              if (email.trim().length === 0) {
                setError({ key: 'auth.enterEmailFirst' });
                return;
              }
              void resetPassword(email.trim())
                .then(() => setNotice('auth.resetSent'))
                .catch((err) => setError({ key: describeAuthError(err) }));
            }}
          />
        ) : null}

        <View style={{ height: theme.spacing.xxl }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
