import React, { useState } from 'react';
import { Alert, Linking, Pressable, Switch, TextInput, View } from 'react-native';
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

export function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { user, signOut, deleteAccount } = useAuth();
  const { profile, updateSettings, updateProfileIdentity } = useProfile();

  const [name, setName] = useState(profile?.displayName ?? '');
  const [savingName, setSavingName] = useState(false);

  if (!profile) return <Screen />;

  const saveName = async () => {
    const error = validateDisplayName(name);
    if (error) {
      Alert.alert('Check that name', error);
      return;
    }
    setSavingName(true);
    await updateProfileIdentity({ displayName: normaliseDisplayName(name) });
    setSavingName(false);
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account',
      'This permanently removes your profile, statistics, badges and leaderboard entries. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteAccount().catch(() =>
              Alert.alert(
                'Could not delete',
                'Please sign in again and retry — deleting an account requires a recent sign-in.',
              ),
            );
          },
        },
      ],
    );
  };

  return (
    <Screen scroll>
      <Text variant="title">Settings</Text>

      {/* Identity */}
      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        Profile
      </Text>
      <Card style={{ marginTop: theme.spacing.md }}>
        <Text variant="caption" tone="muted">
          Display name
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
          accessibilityLabel="Display name"
        />
        <Button
          label="Save name"
          variant="secondary"
          loading={savingName}
          disabled={name === profile.displayName}
          onPress={() => void saveName()}
          style={{ marginTop: theme.spacing.md }}
        />

        <Text variant="caption" tone="muted" style={{ marginTop: theme.spacing.xl }}>
          Avatar
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md, marginTop: theme.spacing.md }}>
          {AVATARS.map((avatar) => (
            <Pressable
              key={avatar.id}
              accessibilityRole="button"
              accessibilityLabel={`Avatar ${avatar.id + 1}`}
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

      {/* Preferences */}
      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        Preferences
      </Text>
      <Card style={{ marginTop: theme.spacing.md }}>
        <Toggle
          label="Haptics"
          hint="Subtle feedback on taps and results."
          value={profile.settings.haptics}
          onChange={(haptics) => void updateSettings({ haptics })}
        />
        <Toggle
          label="Reduced motion"
          hint="Minimise animations across the app."
          value={profile.settings.reducedMotion}
          onChange={(reducedMotion) => void updateSettings({ reducedMotion })}
        />
        <Toggle
          label="Daily reminder"
          hint="A single nudge if your streak is at risk."
          value={profile.settings.dailyReminder}
          onChange={(dailyReminder) => void updateSettings({ dailyReminder })}
        />
      </Card>

      {/* Account */}
      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        Account
      </Text>
      <Card style={{ marginTop: theme.spacing.md }}>
        <Text variant="body">{user?.email ?? 'Playing as a guest'}</Text>
        <Text variant="caption" tone="faint" style={{ marginTop: 2 }}>
          {profile.isAnonymous
            ? 'Progress lives on this device only.'
            : 'Progress is synced to your account.'}
        </Text>

        {profile.isAnonymous ? (
          <Button
            label="Create an account"
            variant="secondary"
            onPress={() => navigation.navigate('Auth', { intent: 'sign_up' })}
            style={{ marginTop: theme.spacing.lg }}
          />
        ) : (
          <Button
            label="Sign out"
            variant="secondary"
            onPress={() => void signOut()}
            style={{ marginTop: theme.spacing.lg }}
          />
        )}

        <Button
          label="Delete account"
          variant="danger"
          onPress={confirmDelete}
          style={{ marginTop: theme.spacing.sm }}
        />
      </Card>

      {/* Legal */}
      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        About
      </Text>
      <Card style={{ marginTop: theme.spacing.md }}>
        <Button
          label="Privacy policy"
          variant="ghost"
          onPress={() => void Linking.openURL(PRIVACY_URL)}
        />
        <Button label="Terms of use" variant="ghost" onPress={() => void Linking.openURL(TERMS_URL)} />
        <Button
          label="Contact support"
          variant="ghost"
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        />
        <Text variant="caption" tone="faint" center style={{ marginTop: theme.spacing.md }}>
          MindCode 1.0.0
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
