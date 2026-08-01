import React from 'react';
import { View } from 'react-native';
import { getVariant } from '@/engine/registry';
import { getFeedbackPolicy } from '@/games/numberLogic/policies';
import { Card, GuessRow, Screen, Text } from '@/ui/components';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useTheme } from '@/ui/ThemeProvider';
import type { RootScreenProps } from '@/navigation/types';

type Props = RootScreenProps<'HowToPlay'>;

/**
 * How to play.
 *
 * Rules are shown by example rather than explained, using the exact same row
 * component the live board uses — so the tutorial can never drift out of sync
 * with the game.
 */
export function HowToPlayScreen({ route }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const variantId = route.params?.variantId ?? 'two-digit';
  const variant = getVariant('number-logic', variantId);
  const policy = getFeedbackPolicy(variant.config.policyId);

  return (
    <Screen scroll>
      <Text variant="title">{t('howToPlay.title')}</Text>
      <Text variant="body" tone="muted" style={{ marginTop: theme.spacing.sm }}>
        {t('howToPlay.intro')}
      </Text>

      <Card style={{ marginTop: theme.spacing.xl }}>
        <Text variant="overline" tone="faint">
          {t('howToPlay.scoringTitle', { policy: t(policy.labelKey) })}
        </Text>
        <Rule symbol="+1" tone="positive" text={t(policy.legend.exact)} />
        <Rule symbol="−1" tone="negative" text={t(policy.legend.misplaced)} />
        <Rule symbol="0" tone="muted" text={t(policy.legend.absent)} />
        <Text variant="caption" tone="faint" style={{ marginTop: theme.spacing.lg }}>
          {t('howToPlay.ambiguity')}
        </Text>
      </Card>

      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        {t('howToPlay.exampleTitle')}
      </Text>
      <View style={{ marginTop: theme.spacing.md }}>
        <GuessRow index={0} guess="56" display="0" score={0} />
        <Text variant="caption" tone="faint" style={{ marginBottom: theme.spacing.lg }}>
          {t('howToPlay.example1')}
        </Text>

        <GuessRow index={1} guess="28" display="−2" score={-2} />
        <Text variant="caption" tone="faint" style={{ marginBottom: theme.spacing.lg }}>
          {t('howToPlay.example2')}
        </Text>

        <GuessRow index={2} guess="82" display="+2" score={2} />
        <Text variant="caption" tone="faint">
          {t('howToPlay.example3')}
        </Text>
      </View>

      <Card style={{ marginTop: theme.spacing.xxl }}>
        <Text variant="bodyStrong">{t('howToPlay.dailyTitle')}</Text>
        <Text variant="body" tone="muted" style={{ marginTop: theme.spacing.sm }}>
          {t('howToPlay.dailyBody')}
        </Text>
      </Card>

      <Card style={{ marginTop: theme.spacing.lg }}>
        <Text variant="bodyStrong">{t('howToPlay.tipTitle')}</Text>
        <Text variant="body" tone="muted" style={{ marginTop: theme.spacing.sm }}>
          {t('howToPlay.tipBody')}
        </Text>
      </Card>
    </Screen>
  );
}

function Rule({
  symbol,
  tone,
  text,
}: {
  symbol: string;
  tone: 'positive' | 'negative' | 'muted';
  text: string;
}) {
  const theme = useTheme();
  const background =
    tone === 'positive'
      ? theme.colors.positiveSoft
      : tone === 'negative'
        ? theme.colors.negativeSoft
        : theme.colors.neutralPill;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.lg }}>
      <View
        style={{
          minWidth: 52,
          paddingVertical: 4,
          alignItems: 'center',
          borderRadius: theme.radius.pill,
          backgroundColor: background,
        }}
      >
        <Text variant="bodyStrong" tone={tone === 'muted' ? 'muted' : tone}>
          {symbol}
        </Text>
      </View>
      <Text variant="body" style={{ flex: 1, marginLeft: theme.spacing.lg }}>
        {text}
      </Text>
    </View>
  );
}
