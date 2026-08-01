import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View } from 'react-native';
import { getGameModule } from '@/engine/registry';
import { describeLevel, nextTitleMilestone } from '@/progress/levels';
import { BADGES } from '@/progress/badges';
import {
  averageDurationMs,
  averageMoves,
  averageScore,
  winRate,
} from '@/progress/types';
import { listRecentSessions } from '@/services/firestore/sessions';
import type { SessionDoc } from '@/services/firestore/schema';
import { useAuth } from '@/state/AuthContext';
import { useProfile } from '@/state/ProfileContext';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  Screen,
  StatTile,
  Text,
} from '@/ui/components';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useTheme } from '@/ui/ThemeProvider';
import { formatDuration } from '@/utils/date';
import type { TabScreenProps } from '@/navigation/types';

type Props = TabScreenProps<'Profile'>;

/**
 * Profile and statistics.
 *
 * Headline numbers come straight from the pre-aggregated profile document, so
 * this screen is a single read and renders offline. The recent-games list is
 * the only network-dependent section and degrades to an empty state.
 */
export function ProfileScreen({ navigation }: Props) {
  const theme = useTheme();
  const { t, locale } = useTranslation();
  const { user } = useAuth();
  const { profile, streak } = useProfile();
  const [recent, setRecent] = useState<SessionDoc[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;
      void listRecentSessions(user.uid, 10)
        .then((sessions) => {
          if (!cancelled) setRecent(sessions);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  if (!profile) {
    return (
      <Screen>
        <EmptyState icon="👤" title={t('profile.loading')} message={t('common.loading')} />
      </Screen>
    );
  }

  const level = describeLevel(profile.xp);
  const nextRank = nextTitleMilestone(level.level);
  const stats = profile.stats;
  const unlockedBadges = Object.keys(profile.badges).length;

  return (
    <Screen scroll>
      <View style={{ alignItems: 'center', paddingTop: theme.spacing.md }}>
        <Avatar avatarId={profile.avatarId} size={84} level={level.level} />
        <Text variant="title" center style={{ marginTop: theme.spacing.lg }}>
          {profile.displayName}
        </Text>
        <Text variant="body" tone="accent" center>
          {t(level.titleKey)}
        </Text>
        {profile.isAnonymous ? (
          <Button
            label={t('profile.createAccount')}
            variant="secondary"
            fullWidth={false}
            onPress={() => navigation.navigate('Auth', { intent: 'sign_up' })}
            style={{ marginTop: theme.spacing.lg }}
          />
        ) : null}
      </View>

      <Card style={{ marginTop: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" tone="muted">
            {t('common.level', { level: level.level })}
          </Text>
          <Text variant="caption" tone="muted">
            {profile.xp.toLocaleString()} {t('common.xp')}
          </Text>
        </View>
        <ProgressBar value={level.ratio} style={{ marginTop: theme.spacing.md }} />
        <Text variant="caption" tone="faint" style={{ marginTop: theme.spacing.sm }}>
          {level.isMaxLevel
            ? t('profile.maxRank')
            : nextRank
              ? t('profile.nextRank', {
                  xp: level.xpForNextLevel - level.xpIntoLevel,
                  level: level.level + 1,
                  title: t(nextRank.titleKey),
                  rankLevel: nextRank.minLevel,
                })
              : t('profile.nextLevel', {
                  xp: level.xpForNextLevel - level.xpIntoLevel,
                  level: level.level + 1,
                })}
        </Text>
      </Card>

      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        {t('profile.statistics')}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.md,
          marginTop: theme.spacing.md,
        }}
      >
        <StatTile
          label={t('profile.gamesPlayed')}
          value={`${stats.played}`}
          hint={t('profile.gamesSolved', { count: stats.won })}
        />
        <StatTile
          label={t('profile.winRate')}
          value={stats.played === 0 ? '—' : `${Math.round(winRate(stats) * 100)}%`}
        />
        <StatTile
          label={t('profile.averageScore')}
          value={stats.played === 0 ? '—' : `${averageScore(stats)}`}
          accent
        />
        <StatTile label={t('profile.bestScore')} value={`${stats.bestScore}`} />
        <StatTile
          label={t('profile.averageGuesses')}
          value={stats.played === 0 ? '—' : `${averageMoves(stats)}`}
          hint={t('profile.totalAttempts', { count: stats.totalMoves })}
        />
        <StatTile
          label={t('profile.averageTime')}
          value={stats.played === 0 ? '—' : formatDuration(averageDurationMs(stats))}
        />
        <StatTile
          label={t('profile.currentStreak')}
          value={streak > 0 ? `${streak} 🔥` : '0'}
          hint={t('profile.longestStreak', { count: profile.streak.longest })}
        />
        <StatTile label={t('profile.dailyChallenges')} value={`${stats.dailyCompleted}`} />
      </View>

      <Card onPress={() => navigation.navigate('Badges')} style={{ marginTop: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{t('profile.badges')}</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
              {t('profile.badgesUnlocked', { unlocked: unlockedBadges, total: BADGES.length })}
            </Text>
          </View>
          <Text variant="body" tone="faint">
            ›
          </Text>
        </View>
      </Card>

      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        {t('profile.byVariant')}
      </Text>
      {Object.entries(profile.modules).flatMap(([moduleId, moduleStats]) =>
        Object.entries(moduleStats.variants).map(([variantId, variantStats]) => {
          let title = variantId;
          try {
            const titleKey = getGameModule(moduleId).variants.find(
              (v) => v.id === variantId,
            )?.titleKey;
            if (titleKey) title = t(titleKey);
          } catch {
            /* module no longer registered — fall back to the raw id */
          }
          return (
            <Card key={`${moduleId}:${variantId}`} style={{ marginTop: theme.spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{title}</Text>
                  <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                    {t('profile.variantRecord', {
                      won: variantStats.won,
                      played: variantStats.played,
                    })}
                    {variantStats.bestMoves > 0
                      ? t('profile.variantBest', { count: variantStats.bestMoves })
                      : ''}
                  </Text>
                </View>
                <Text variant="bodyStrong" tone="accent">
                  {variantStats.bestScore}
                </Text>
              </View>
            </Card>
          );
        }),
      )}
      {Object.keys(profile.modules).length === 0 ? (
        <Text variant="caption" tone="faint" style={{ marginTop: theme.spacing.md }}>
          {t('profile.noRecord')}
        </Text>
      ) : null}

      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        {t('profile.recentGames')}
      </Text>
      {recent.length === 0 ? (
        <Text variant="caption" tone="faint" style={{ marginTop: theme.spacing.md }}>
          {t('profile.noRecentGames')}
        </Text>
      ) : (
        recent.map((session) => (
          <View
            key={session.sessionId}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: theme.spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}
          >
            <Text variant="body" style={{ width: 34 }}>
              {session.status === 'won' ? '✓' : '·'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text variant="body">{session.solution}</Text>
              <Text variant="caption" tone="faint">
                {new Date(session.finishedAt).toLocaleDateString(locale)} ·{' '}
                {session.mode === 'daily' ? t('profile.modeDaily') : t('profile.modeClassic')} ·{' '}
                {session.movesUsed}/{session.maxMoves}
              </Text>
            </View>
            <Text variant="bodyStrong" tone="muted">
              {session.score}
            </Text>
          </View>
        ))
      )}

      <Button
        label={t('profile.settings')}
        variant="secondary"
        onPress={() => navigation.navigate('Settings')}
        style={{ marginTop: theme.spacing.xxl }}
      />
    </Screen>
  );
}
