import React, { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View } from 'react-native';
import { getGameModule, listGameModules, listLiveGameModules } from '@/engine/registry';
import { buildSeed } from '@/engine/rng';
import { dailySessionId } from '@/daily/challenge';
import { describeLevel } from '@/progress/levels';
import { track } from '@/services/analytics';
import { useAuth } from '@/state/AuthContext';
import { useDailyChallenge } from '@/state/useDailyChallenge';
import { useProfile } from '@/state/ProfileContext';
import { Avatar, Button, Card, ProgressBar, Screen, Text } from '@/ui/components';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useTheme } from '@/ui/ThemeProvider';
import { formatCountdown } from '@/utils/date';
import type { TabScreenProps } from '@/navigation/types';

type Props = TabScreenProps<'Home'>;

/**
 * Home.
 *
 * One screen, one obvious action: play today's challenge. Everything else —
 * free play, the roadmap, progression — sits below the fold. A returning
 * player should be able to open the app and start thinking within one tap.
 */
export function HomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile, streak } = useProfile();
  const { challenge, entry, msRemaining, refresh } = useDailyChallenge(user?.uid ?? null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const level = describeLevel(profile?.xp ?? 0);
  const dailyModule = getGameModule(challenge.moduleId);
  const dailyVariant = dailyModule.variants.find((v) => v.id === challenge.variantId);
  const alreadyPlayed = entry !== null;

  const startDaily = () => {
    if (!user) return;
    navigation.navigate('Game', {
      sessionId: dailySessionId(user.uid, challenge.id),
      moduleId: challenge.moduleId,
      variantId: challenge.variantId,
      mode: 'daily',
      seed: challenge.seed,
      challengeId: challenge.id,
    });
  };

  const startClassic = (moduleId: string, variantId: string) => {
    if (!user) return;
    navigation.navigate('Game', {
      sessionId: `${user.uid}_${moduleId}_${variantId}_${Date.now()}`,
      moduleId,
      variantId,
      mode: 'classic',
      seed: buildSeed('classic', user.uid, moduleId, variantId, Date.now()),
      challengeId: null,
    });
  };

  return (
    <Screen scroll>
      {/* Identity + progression */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar avatarId={profile?.avatarId ?? 0} size={52} level={level.level} />
        <View style={{ flex: 1, marginLeft: theme.spacing.lg }}>
          <Text variant="heading" numberOfLines={1}>
            {profile?.displayName ?? t('home.welcome')}
          </Text>
          <Text variant="caption" tone="muted">
            {t(level.titleKey)}
          </Text>
        </View>
        <View
          style={{
            alignItems: 'center',
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radius.md,
            backgroundColor: streak > 0 ? theme.colors.accentSoft : theme.colors.neutralPill,
          }}
        >
          <Text variant="bodyStrong" tone={streak > 0 ? 'accent' : 'faint'}>
            {streak > 0 ? `🔥 ${streak}` : '—'}
          </Text>
          <Text variant="caption" tone="faint">
            {t('common.streak')}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
        <ProgressBar
          value={level.ratio}
          accessibilityLabel={t('a11y.levelProgress', { level: level.level })}
        />
        <Text variant="caption" tone="faint" style={{ marginTop: theme.spacing.sm }}>
          {level.isMaxLevel
            ? t('home.maxLevel', { xp: profile?.xp ?? 0 })
            : t('home.xpToNextLevel', {
                into: level.xpIntoLevel,
                span: level.xpForNextLevel,
                level: level.level + 1,
              })}
        </Text>
      </View>

      {/* Daily Challenge */}
      <Card highlighted={!alreadyPlayed} style={{ marginTop: theme.spacing.xl }}>
        <Text variant="overline" tone="accent">
          {t('home.dailyChallenge')}
        </Text>
        <Text variant="title" style={{ marginTop: theme.spacing.sm }}>
          {dailyVariant ? t(dailyVariant.titleKey) : t('home.dailyChallenge')}
        </Text>
        <Text variant="body" tone="muted" style={{ marginTop: theme.spacing.xs }}>
          {alreadyPlayed
            ? entry?.status === 'won'
              ? t('home.dailySolved', { count: entry.movesUsed, score: entry.score })
              : t('home.dailySpent')
            : t('home.dailyIntro')}
        </Text>

        {challenge.stats && challenge.stats.played > 0 ? (
          <Text variant="caption" tone="faint" style={{ marginTop: theme.spacing.md }}>
            {t('home.communityStats', {
              played: challenge.stats.played.toLocaleString(),
              percent: Math.round((challenge.stats.solved / challenge.stats.played) * 100),
            })}
          </Text>
        ) : null}

        <View style={{ marginTop: theme.spacing.xl }}>
          {alreadyPlayed ? (
            <View style={{ alignItems: 'center' }}>
              <Text variant="caption" tone="faint">
                {t('home.nextChallenge')}
              </Text>
              <Text variant="heading" tone="accent" style={{ marginTop: theme.spacing.xs }}>
                {formatCountdown(msRemaining)}
              </Text>
            </View>
          ) : (
            <Button label={t('home.play')} onPress={startDaily} icon="▶" />
          )}
        </View>
      </Card>

      {/* Free play — one section per live module, driven by the registry.
          This deliberately does not name a game: shipping a second module adds
          a section here with no edit. */}
      {listLiveGameModules().map((module) => (
        <View key={module.id}>
          <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
            {module.icon}  {t(module.titleKey)}
          </Text>
          <Text variant="caption" tone="faint" style={{ marginTop: theme.spacing.xs }}>
            {t(module.taglineKey)}
          </Text>

          {module.variants.map((variant) => {
            const locked = variant.unlocksAtLevel > level.level;

            if (locked) {
              return (
                <Card
                  key={variant.id}
                  style={{ marginTop: theme.spacing.md, opacity: 0.55 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{t(variant.titleKey)}</Text>
                      <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                        {t('home.unlocksAtLevel', { level: variant.unlocksAtLevel })}
                      </Text>
                    </View>
                    <Text variant="caption" tone="faint">
                      🔒
                    </Text>
                  </View>
                </Card>
              );
            }

            return (
              <Card
                key={variant.id}
                onPress={() => startClassic(module.id, variant.id)}
                accessibilityLabel={t('home.playVariant', {
                  module: t(module.titleKey),
                  variant: t(variant.titleKey),
                })}
                style={{ marginTop: theme.spacing.md }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{t(variant.titleKey)}</Text>
                    <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                      {t(variant.subtitleKey)}
                    </Text>
                  </View>
                  <Text variant="caption" tone="faint">
                    {'★'.repeat(variant.difficulty)}
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>
      ))}

      {/* Roadmap */}
      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        {t('home.comingSoon')}
      </Text>
      <Text variant="caption" tone="faint" style={{ marginTop: theme.spacing.xs }}>
        {t('home.comingSoonBody')}
      </Text>
      {listGameModules()
        .filter((module) => module.status === 'coming_soon')
        .map((module) => (
          <Card key={module.id} style={{ marginTop: theme.spacing.md, opacity: 0.5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 22, marginRight: theme.spacing.lg }}>{module.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{t(module.titleKey)}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                  {t(module.taglineKey)}
                </Text>
              </View>
            </View>
          </Card>
        ))}

      <Button
        label={t('home.howToPlay')}
        variant="ghost"
        onPress={() => {
          track('screen_view', { screen: 'HowToPlay' });
          navigation.navigate('HowToPlay', { variantId: challenge.variantId });
        }}
        style={{ marginTop: theme.spacing.lg }}
      />
    </Screen>
  );
}
