import React, { useState } from 'react';
import { Alert, Linking, Pressable, Switch, TextInput, View } from 'react-native';
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@/i18n';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { LocalePreference } from '@/i18n/types';
import { AVATARS } from '@/ui/theme';
import { useAuth } from '@/state/AuthContext';
import { useProfile } from '@/state/ProfileContext';
import { Avatar, Button, Card, Screen, Text } from '@/ui/components';
import { useTheme } from '@/ui/ThemeProvider';
import { normaliseDisplayName, validateDisplayName } from '@/utils/names';
import type { RootScreenProps } from '@/navigation/types';

type Props = RootScreenProps<'Settings'>;

const PRIVACY_URL = 'https://mindcode.app/privacy';
const TERMS_URL = 'https://mindcode.app/terms';
const SUPPORT_EMAIL = 'support@mindcode.app';
const APP_VERSION = '1.0.0';

/** Device language first, then every locale the app ships. */
const LOCALE_OPTIONS: LocalePreference[] = ['system', ...SUPPORTED_LOCALES];

export function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { user, signOut, deleteAccount } = useAuth();
  const { profile, updateSettings, updateProfileIdentity } = useProfile();

  const [name, setName] = useState(profile?.displayName ?? '');
  const [savingName, setSavingName] = useState(false);

  if (!profile) return <Screen />;

  const saveName = async () => {
    const error = validateDisplayName(name);
    if (error) {
      Alert.alert(t('settings.checkName'), t(error.key, error.params));
      return;
    }
    setSavingName(true);
    await updateProfileIdentity({ displayName: normaliseDisplayName(name) });
    setSavingName(false);
  };

  const confirmDelete = () => {
    Alert.alert(t('settings.deleteTitle'), t('settings.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          void deleteAccount().catch(() =>
            Alert.alert(t('settings.deleteFailedTitle'), t('settings.deleteFailedBody')),
          );
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <Text variant="title">{t('settings.title')}</Text>

      {/* Identity */}
      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        {t('settings.profile')}
      </Text>
      <Card style={{ marginTop: theme.spacing.md }}>
        <Text variant="caption" tone="muted">
          {t('settings.displayName')}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={20}
          style={{
            height: 48,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            color: theme.colors.text,
            paddingHorizontal: theme.spacing.md,
            marginTop: theme.spacing.sm,
            fontSize: 16,
          }}
          accessibilityLabel={t('settings.displayName')}
        />
        <Button
          label={t('settings.saveName')}
          variant="secondary"
          loading={savingName}
          disabled={name === profile.displayName}
          onPress={() => void saveName()}
          style={{ marginTop: theme.spacing.md }}
        />

        <Text variant="caption" tone="muted" style={{ marginTop: theme.spacing.xl }}>
          {t('settings.avatar')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md, marginTop: theme.spacing.md }}>
          {AVATARS.map((avatar) => (
            <Pressable
              key={avatar.id}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.avatarOption', { number: avatar.id + 1 })}
              accessibilityState={{ selected: avatar.id === profile.avatarId }}
              onPress={() => void updateProfileIdentity({ avatarId: avatar.id })}
              style={{
                borderRadius: 30,
                padding: 3,
                borderWidth: 2,
                borderColor:
                  avatar.id === profile.avatarId ? theme.colors.accent : 'transparent',
              }}
            >
              <Avatar avatarId={avatar.id} size={48} />
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Language.
          Its own section rather than a row inside Preferences: a player whose
          app opened in the wrong language needs to find this without reading
          anything, and a labelled block of native language names is the one
          control that works even when every other word on screen is foreign. */}
      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        {t('settings.language')}
      </Text>
      <Card style={{ marginTop: theme.spacing.md }}>
        {LOCALE_OPTIONS.map((option) => {
          const selected = profile.settings.locale === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessible
              accessibilityState={{ selected }}
              accessibilityLabel={
                option === 'system' ? t('settings.languageSystem') : LOCALE_NAMES[option]
              }
              onPress={() => void updateSettings({ locale: option })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: theme.spacing.md,
              }}
            >
              <Text variant="body" style={{ flex: 1 }}>
                {option === 'system' ? t('settings.languageSystem') : LOCALE_NAMES[option]}
              </Text>
              <Text variant="bodyStrong" tone={selected ? 'accent' : 'faint'}>
                {selected ? '✓' : ''}
              </Text>
            </Pressable>
          );
        })}
      </Card>

      {/* Preferences */}
      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        {t('settings.preferences')}
      </Text>
      <Card style={{ marginTop: theme.spacing.md }}>
        <Toggle
          label={t('settings.haptics')}
          hint={t('settings.hapticsHint')}
          value={profile.settings.haptics}
          onChange={(haptics) => void updateSettings({ haptics })}
        />
        <Toggle
          label={t('settings.reducedMotion')}
          hint={t('settings.reducedMotionHint')}
          value={profile.settings.reducedMotion}
          onChange={(reducedMotion) => void updateSettings({ reducedMotion })}
        />
        <Toggle
          label={t('settings.dailyReminder')}
          hint={t('settings.dailyReminderHint')}
          value={profile.settings.dailyReminder}
          onChange={(dailyReminder) => void updateSettings({ dailyReminder })}
        />
      </Card>

      {/* Account */}
      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        {t('settings.account')}
      </Text>
      <Card style={{ marginTop: theme.spacing.md }}>
        <Text variant="body">{user?.email ?? t('settings.guest')}</Text>
        <Text variant="caption" tone="faint" style={{ marginTop: 2 }}>
          {profile.isAnonymous ? t('settings.localOnly') : t('settings.synced')}
        </Text>

        {profile.isAnonymous ? (
          <Button
            label={t('auth.createAccount')}
            variant="secondary"
            onPress={() => navigation.navigate('Auth', { intent: 'sign_up' })}
            style={{ marginTop: theme.spacing.lg }}
          />
        ) : (
          <Button
            label={t('settings.signOut')}
            variant="secondary"
            onPress={() => void signOut()}
            style={{ marginTop: theme.spacing.lg }}
          />
        )}

        <Button
          label={t('settings.deleteAccount')}
          variant="danger"
          onPress={confirmDelete}
          style={{ marginTop: theme.spacing.sm }}
        />
      </Card>

      {/* Legal */}
      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        {t('settings.about')}
      </Text>
      <Card style={{ marginTop: theme.spacing.md }}>
        <Button
          label={t('settings.privacy')}
          variant="ghost"
          onPress={() => void Linking.openURL(PRIVACY_URL)}
        />
        <Button
          label={t('settings.terms')}
          variant="ghost"
          onPress={() => void Linking.openURL(TERMS_URL)}
        />
        <Button
          label={t('settings.support')}
          variant="ghost"
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        />
        <Text variant="caption" tone="faint" center style={{ marginTop: theme.spacing.md }}>
          {t('settings.version', { version: APP_VERSION })}
        </Text>
      </Card>
    </Screen>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
      }}
    >
      <View style={{ flex: 1, paddingRight: theme.spacing.lg }}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" tone="faint" style={{ marginTop: 2 }}>
          {hint}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
        accessibilityLabel={label}
      />
    </View>
  );
}
