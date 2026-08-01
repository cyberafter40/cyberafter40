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
        <EmptyState icon="👤" title="Loading profile" message="Just a moment." />
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
          {level.title}
        </Text>
        {profile.isAnonymous ? (
          <Button
            label="Create an account to save progress"
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
            Level {level.level}
          </Text>
          <Text variant="caption" tone="muted">
            {profile.xp.toLocaleString()} XP
          </Text>
        </View>
        <ProgressBar value={level.ratio} style={{ marginTop: theme.spacing.md }} />
        <Text variant="caption" tone="faint" style={{ marginTop: theme.spacing.sm }}>
          {level.isMaxLevel
            ? 'You have reached the highest rank.'
            : nextRank
              ? `${level.xpForNextLevel - level.xpIntoLevel} XP to level ${level.level + 1} · ${nextRank.title} at level ${nextRank.minLevel}`
              : `${level.xpForNextLevel - level.xpIntoLevel} XP to level ${level.level + 1}`}
        </Text>
      </Card>

      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        Statistics
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.md,
          marginTop: theme.spacing.md,
        }}
      >
        <StatTile label="Games played" value={`${stats.played}`} hint={`${stats.won} solved`} />
        <StatTile
          label="Win rate"
          value={stats.played === 0 ? '—' : `${Math.round(winRate(stats) * 100)}%`}
        />
        <StatTile
          label="Average score"
          value={stats.played === 0 ? '—' : `${averageScore(stats)}`}
          accent
        />
        <StatTile label="Best score" value={`${stats.bestScore}`} />
        <StatTile
          label="Avg. guesses"
          value={stats.played === 0 ? '—' : `${averageMoves(stats)}`}
          hint={`${stats.totalMoves} total attempts`}
        />
        <StatTile
          label="Avg. time"
          value={stats.played === 0 ? '—' : formatDuration(averageDurationMs(stats))}
        />
        <StatTile
          label="Current streak"
          value={streak > 0 ? `${streak} 🔥` : '0'}
          hint={`longest ${profile.streak.longest}`}
        />
        <StatTile label="Daily challenges" value={`${stats.dailyCompleted}`} />
      </View>

      <Card onPress={() => navigation.navigate('Badges')} style={{ marginTop: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">Badges</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
              {unlockedBadges} of {BADGES.length} unlocked
            </Text>
          </View>
          <Text variant="body" tone="faint">
            ›
          </Text>
        </View>
      </Card>

      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        By variant
      </Text>
      {Object.entries(profile.modules).flatMap(([moduleId, moduleStats]) =>
        Object.entries(moduleStats.variants).map(([variantId, variantStats]) => {
          let title = variantId;
          try {
            title =
              getGameModule(moduleId).variants.find((v) => v.id === variantId)?.title ?? variantId;
          } catch {
            /* module no longer registered — fall back to the raw id */
          }
          return (
            <Card key={`${moduleId}:${variantId}`} style={{ marginTop: theme.spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{title}</Text>
                  <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                    {variantStats.won}/{variantStats.played} solved
                    {variantStats.bestMoves > 0 ? ` · best ${variantStats.bestMoves} guesses` : ''}
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
          Play a game to start building your record.
        </Text>
      ) : null}

      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        Recent games
      </Text>
      {recent.length === 0 ? (
        <Text variant="caption" tone="faint" style={{ marginTop: theme.spacing.md }}>
          Your last games will appear here once they sync.
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
                {new Date(session.finishedAt).toLocaleDateString()} ·{' '}
                {session.mode === 'daily' ? 'Daily' : 'Classic'} · {session.movesUsed}/
                {session.maxMoves}
              </Text>
            </View>
            <Text variant="bodyStrong" tone="muted">
              {session.score}
            </Text>
          </View>
        ))
      )}

      <Button
        label="Settings"
        variant="secondary"
        onPress={() => navigation.navigate('Settings')}
        style={{ marginTop: theme.spacing.xxl }}
      />
    </Screen>
  );
}
