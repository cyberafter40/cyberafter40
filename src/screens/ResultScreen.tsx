import React, { useEffect } from 'react';
import { Share, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { getVariant } from '@/engine/registry';
import { RATING_KEYS } from '@/scoring/scoringEngine';
import { useTranslation } from '@/i18n/LocaleProvider';
import { track } from '@/services/analytics';
import { successFeedback, warningFeedback } from '@/ui/haptics';
import { Button, Card, Screen, StatTile, Text } from '@/ui/components';
import { useTheme } from '@/ui/ThemeProvider';
import { formatDuration } from '@/utils/date';
import type { RootScreenProps } from '@/navigation/types';

type Props = RootScreenProps<'Result'>;

/**
 * Result.
 *
 * Reveals in one calm beat: outcome, then the code, then what it earned. The
 * score breakdown is itemised rather than a single number so the player learns
 * *why* efficiency and deduction paid off — that is the loop that makes them
 * better, and better players come back.
 */
export function ResultScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const params = route.params;
  const won = params.status === 'won';
  const rating = RATING_KEYS[params.score.rating];
  const variant = getVariant(params.moduleId, params.variantId);

  useEffect(() => {
    if (won) successFeedback();
    else warningFeedback();
  }, [won]);

  const levelUp = params.events.find((event) => event.type === 'level_up');
  const badges = params.events.filter((event) => event.type === 'badge_unlocked');
  const streak = params.events.find(
    (event) => event.type === 'streak_extended' || event.type === 'streak_started',
  );

  const share = async () => {
    const grid = params.guesses
      .map((guess) => {
        const [, score = ''] = guess.split(':');
        return score.trim();
      })
      .join(' ');

    track('share_result', { mode: params.mode, status: params.status });
    await Share.share({
      message:
        `MindCode ${params.mode === 'daily' ? t('profile.modeDaily') : t(variant.titleKey)}\n` +
        `${won ? `${params.movesUsed}/${params.maxMoves}` : `X/${params.maxMoves}`}  ${grid}\n` +
        `${params.score.total} points`,
    }).catch(() => undefined);
  };

  return (
    <Screen
      scroll
      footer={
        <View>
          <Button label={t('common.done')} onPress={() => navigation.navigate('Tabs')} />
          <Button
            label={t('result.share')}
            variant="ghost"
            onPress={() => void share()}
            style={{ marginTop: theme.spacing.sm }}
          />
        </View>
      }
    >
      <Animated.View entering={FadeIn.duration(320)} style={{ alignItems: 'center', paddingTop: theme.spacing.xl }}>
        <Text style={{ fontSize: 48 }}>{won ? '✓' : '·'}</Text>
        <Text variant="title" center style={{ marginTop: theme.spacing.md }}>
          {t(rating.title)}
        </Text>
        <Text variant="body" tone="muted" center style={{ marginTop: theme.spacing.xs }}>
          {t(rating.subtitle)}
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(160).duration(360)}>
        <Card style={{ marginTop: theme.spacing.xl, alignItems: 'center' }}>
          <Text variant="overline" tone="faint">
            {t('result.codeWas')}
          </Text>
          <Text
            style={{
              ...theme.typography.mono,
              fontSize: 40,
              letterSpacing: 12,
              color: won ? theme.colors.positive : theme.colors.text,
              marginTop: theme.spacing.sm,
            }}
          >
            {params.solution}
          </Text>
        </Card>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(280).duration(360)}
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.md,
          marginTop: theme.spacing.lg,
        }}
      >
        <StatTile label={t('result.score')} value={`${params.score.total}`} accent />
        <StatTile label={t('result.xpEarned')} value={`+${params.score.xp}`} />
        <StatTile
          label={t('result.guesses')}
          value={won ? `${params.movesUsed}/${params.maxMoves}` : `X/${params.maxMoves}`}
        />
        <StatTile label={t('result.time')} value={formatDuration(params.durationMs)} />
      </Animated.View>

      {params.score.components.length > 0 ? (
        <Card style={{ marginTop: theme.spacing.lg }}>
          <Text variant="overline" tone="faint">
            {t('result.howItScored')}
          </Text>
          {params.score.components.map((component) => (
            <View
              key={component.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: theme.spacing.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="body">{t(component.labelKey)}</Text>
                {component.detailKey ? (
                  <Text variant="caption" tone="faint">
                    {t(component.detailKey, component.detailParams)}
                  </Text>
                ) : null}
              </View>
              <Text
                variant="bodyStrong"
                tone={component.points >= 0 ? 'positive' : 'negative'}
              >
                {component.kind === 'multiply'
                  ? `×${component.value}`
                  : `${component.points >= 0 ? '+' : ''}${component.points}`}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {params.score.isPersonalBest ? (
        <Card highlighted style={{ marginTop: theme.spacing.lg }}>
          <Text variant="bodyStrong" tone="accent">
            {t('result.personalBest')}
          </Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {t('result.personalBestBody', { variant: t(variant.titleKey) })}
          </Text>
        </Card>
      ) : null}

      {levelUp && levelUp.type === 'level_up' ? (
        <Card highlighted style={{ marginTop: theme.spacing.lg }}>
          <Text variant="bodyStrong" tone="accent">
            {t('result.levelUp', { level: levelUp.to, title: t(levelUp.titleKey) })}
          </Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {t('result.levelUpBody')}
          </Text>
        </Card>
      ) : null}

      {streak && (streak.type === 'streak_extended' || streak.type === 'streak_started') ? (
        <Card style={{ marginTop: theme.spacing.lg }}>
          <Text variant="bodyStrong">{t('result.streak', { count: streak.current })}</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {t('result.streakBody')}
          </Text>
        </Card>
      ) : null}

      {badges.map((badge) =>
        badge.type === 'badge_unlocked' ? (
          <Card key={badge.badgeId} style={{ marginTop: theme.spacing.lg }}>
            <Text variant="bodyStrong">{t('result.badge', { title: t(badge.titleKey) })}</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
              {t(badge.descriptionKey)}
            </Text>
          </Card>
        ) : null,
      )}

      {params.rejection ? (
        <Text variant="caption" tone="negative" center style={{ marginTop: theme.spacing.lg }}>
          {t('result.rejected')}
        </Text>
      ) : !params.synced ? (
        <Text variant="caption" tone="faint" center style={{ marginTop: theme.spacing.lg }}>
          {t('result.notSynced')}
        </Text>
      ) : null}
    </Screen>
  );
}
