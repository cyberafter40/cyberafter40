import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { levelTitle } from '@/progress/levels';
import { track } from '@/services/analytics';
import {
  fetchLeaderboard,
  fetchMyEntry,
  PERIOD_LABELS,
  PERIOD_METRIC_LABELS,
  type LeaderboardPeriod,
  type LeaderboardRow,
} from '@/services/firestore/leaderboard';
import type { LeaderboardEntryDoc } from '@/services/firestore/schema';
import { useAuth } from '@/state/AuthContext';
import { Avatar, EmptyState, Screen, SegmentedControl, Text } from '@/ui/components';
import { useTheme } from '@/ui/ThemeProvider';

/**
 * Leaderboards.
 *
 * Three periods share one list. The player's own row is pinned below the board
 * when they are outside the visible top 50, so the screen always answers "where
 * am I?" — the only question that keeps a leaderboard motivating rather than
 * discouraging.
 */
export function LeaderboardScreen() {
  const theme = useTheme();
  const { user } = useAuth();

  const [period, setPeriod] = useState<LeaderboardPeriod>('daily');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [mine, setMine] = useState<LeaderboardEntryDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [board, own] = await Promise.all([
        fetchLeaderboard({ period, currentUid: user?.uid ?? null, count: 50 }),
        user ? fetchMyEntry(period, user.uid).catch(() => null) : Promise.resolve(null),
      ]);
      setRows(board);
      setMine(own);
    } catch {
      setError('Could not load the leaderboard. Pull to retry.');
    } finally {
      setLoading(false);
    }
  }, [period, user]);

  useEffect(() => {
    setLoading(true);
    void load();
    track('leaderboard_viewed', { period });
  }, [load, period]);

  const inVisibleBoard = rows.some((row) => row.isCurrentUser);

  return (
    <Screen>
      <Text variant="title">Leaderboard</Text>
      <Text variant="caption" tone="muted" style={{ marginTop: theme.spacing.xs }}>
        Ranked by {PERIOD_METRIC_LABELS[period]}.
      </Text>

      <View style={{ marginTop: theme.spacing.lg }}>
        <SegmentedControl
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'daily', label: PERIOD_LABELS.daily },
            { value: 'weekly', label: PERIOD_LABELS.weekly },
            { value: 'global', label: PERIOD_LABELS.global },
          ]}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: theme.spacing.xxxl }} color={theme.colors.accent} />
      ) : (
        <ScrollView
          style={{ flex: 1, marginTop: theme.spacing.lg }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={theme.colors.textMuted} />
          }
        >
          {rows.length === 0 ? (
            <EmptyState
              icon="🏁"
              title={error ? 'Nothing to show' : 'Be the first'}
              message={
                error ??
                (period === 'daily'
                  ? 'No one has finished today’s challenge yet. Play it and take the top spot.'
                  : 'Scores will appear here as players complete games.')
              }
            />
          ) : (
            rows.map((row) => <Row key={row.uid} row={row} period={period} />)
          )}

          {mine && !inVisibleBoard ? (
            <View style={{ marginTop: theme.spacing.lg }}>
              <Text variant="overline" tone="faint">
                Your position
              </Text>
              <Row
                row={{ ...mine, rank: 0, isCurrentUser: true }}
                period={period}
                hideRank
              />
            </View>
          ) : null}

          <View style={{ height: theme.spacing.xxl }} />
        </ScrollView>
      )}
    </Screen>
  );
}

function Row({
  row,
  period,
  hideRank = false,
}: {
  row: LeaderboardRow;
  period: LeaderboardPeriod;
  hideRank?: boolean;
}) {
  const theme = useTheme();
  const medal = ['🥇', '🥈', '🥉'][row.rank - 1];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${hideRank ? '' : `Rank ${row.rank}, `}${row.displayName}, ${row.score} ${PERIOD_METRIC_LABELS[period]}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        marginBottom: theme.spacing.xs,
        borderRadius: theme.radius.md,
        backgroundColor: row.isCurrentUser ? theme.colors.accentSoft : 'transparent',
      }}
    >
      <Text variant="caption" tone="faint" style={{ width: 34 }}>
        {hideRank ? '' : (medal ?? row.rank)}
      </Text>
      <Avatar avatarId={row.avatarId} size={36} />
      <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
        <Text variant="body" numberOfLines={1}>
          {row.displayName}
        </Text>
        <Text variant="caption" tone="faint">
          {period === 'daily'
            ? `${row.movesUsed ?? '—'} guesses`
            : `Level ${row.level} · ${levelTitle(row.level)}`}
        </Text>
      </View>
      <Text variant="bodyStrong" tone={row.isCurrentUser ? 'accent' : 'default'}>
        {row.score.toLocaleString()}
      </Text>
    </View>
  );
}
