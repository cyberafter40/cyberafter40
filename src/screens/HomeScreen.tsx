import React, { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View } from 'react-native';
import { getGameModule, listGameModules, unlockedVariants } from '@/engine/registry';
import { buildSeed } from '@/engine/rng';
import { dailySessionId } from '@/daily/challenge';
import { describeLevel } from '@/progress/levels';
import { track } from '@/services/analytics';
import { useAuth } from '@/state/AuthContext';
import { useDailyChallenge } from '@/state/useDailyChallenge';
import { useProfile } from '@/state/ProfileContext';
import { Avatar, Button, Card, ProgressBar, Screen, Text } from '@/ui/components';
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
            {profile?.displayName ?? 'Welcome'}
          </Text>
          <Text variant="caption" tone="muted">
            {level.title}
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
            streak
          </Text>
        </View>
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
        <ProgressBar
          value={level.ratio}
          accessibilityLabel={`Level ${level.level} progress`}
        />
        <Text variant="caption" tone="faint" style={{ marginTop: theme.spacing.sm }}>
          {level.isMaxLevel
            ? `${profile?.xp ?? 0} XP · maximum level`
            : `${level.xpIntoLevel} / ${level.xpForNextLevel} XP to level ${level.level + 1}`}
        </Text>
      </View>

      {/* Daily Challenge */}
      <Card highlighted={!alreadyPlayed} style={{ marginTop: theme.spacing.xl }}>
        <Text variant="overline" tone="accent">
          Daily Challenge
        </Text>
        <Text variant="title" style={{ marginTop: theme.spacing.sm }}>
          {dailyVariant?.title ?? 'Today’s code'}
        </Text>
        <Text variant="body" tone="muted" style={{ marginTop: theme.spacing.xs }}>
          {alreadyPlayed
            ? entry?.status === 'won'
              ? `Solved in ${entry.movesUsed} guess${entry.movesUsed === 1 ? '' : 'es'} for ${entry.score} points.`
              : 'You have used today’s attempt. The code stays secret until tomorrow.'
            : 'Everyone in the world gets the same code today. One attempt.'}
        </Text>

        {challenge.stats && challenge.stats.played > 0 ? (
          <Text variant="caption" tone="faint" style={{ marginTop: theme.spacing.md }}>
            {challenge.stats.played.toLocaleString()} played ·{' '}
            {Math.round((challenge.stats.solved / challenge.stats.played) * 100)}% solved
          </Text>
        ) : null}

        <View style={{ marginTop: theme.spacing.xl }}>
          {alreadyPlayed ? (
            <View style={{ alignItems: 'center' }}>
              <Text variant="caption" tone="faint">
                Next challenge in
              </Text>
              <Text variant="heading" tone="accent" style={{ marginTop: theme.spacing.xs }}>
                {formatCountdown(msRemaining)}
              </Text>
            </View>
          ) : (
            <Button label="Play today’s code" onPress={startDaily} icon="▶" />
          )}
        </View>
      </Card>

      {/* Free play */}
      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        Classic
      </Text>
      {unlockedVariants('number-logic', level.level).map((variant) => (
        <Card
          key={variant.id}
          onPress={() => startClassic('number-logic', variant.id)}
          accessibilityLabel={`Play ${variant.title}`}
          style={{ marginTop: theme.spacing.md }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{variant.title}</Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                {variant.subtitle}
              </Text>
            </View>
            <Text variant="caption" tone="faint">
              {'★'.repeat(variant.difficulty)}
            </Text>
          </View>
        </Card>
      ))}

      {getGameModule('number-logic').variants
        .filter((variant) => variant.unlocksAtLevel > level.level)
        .map((variant) => (
          <Card key={variant.id} style={{ marginTop: theme.spacing.md, opacity: 0.55 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{variant.title}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                  Unlocks at level {variant.unlocksAtLevel}
                </Text>
              </View>
              <Text variant="caption" tone="faint">
                🔒
              </Text>
            </View>
          </Card>
        ))}

      {/* Roadmap */}
      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        Coming to MindCode
      </Text>
      <Text variant="caption" tone="faint" style={{ marginTop: theme.spacing.xs }}>
        More ways to train, built on the same engine.
      </Text>
      {listGameModules()
        .filter((module) => module.status === 'coming_soon')
        .map((module) => (
          <Card key={module.id} style={{ marginTop: theme.spacing.md, opacity: 0.5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 22, marginRight: theme.spacing.lg }}>{module.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{module.title}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                  {module.tagline}
                </Text>
              </View>
            </View>
          </Card>
        ))}

      <Button
        label="How to play"
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
