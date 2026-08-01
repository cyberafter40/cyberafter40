import React from 'react';
import { View } from 'react-native';
import { getVariant } from '@/engine/registry';
import { getFeedbackPolicy } from '@/games/numberLogic/policies';
import { Card, GuessRow, Screen, Text } from '@/ui/components';
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
  const variantId = route.params?.variantId ?? 'two-digit';
  const variant = getVariant('number-logic', variantId);
  const policy = getFeedbackPolicy(variant.config.policyId);

  return (
    <Screen scroll>
      <Text variant="title">How to play</Text>
      <Text variant="body" tone="muted" style={{ marginTop: theme.spacing.sm }}>
        A code is hidden. Guess it. Every guess comes back as a single number
        that tells you how close you were.
      </Text>

      <Card style={{ marginTop: theme.spacing.xl }}>
        <Text variant="overline" tone="faint">
          Scoring — {policy.label}
        </Text>
        <Rule
          symbol="+1"
          tone="positive"
          text={policy.legend.exact}
        />
        <Rule symbol="−1" tone="negative" text={policy.legend.misplaced} />
        <Rule symbol="0" tone="muted" text={policy.legend.absent} />
        <Text variant="caption" tone="faint" style={{ marginTop: theme.spacing.lg }}>
          The number you see is the total. That total can be ambiguous — and
          working out which combination produced it is the game.
        </Text>
      </Card>

      <Text variant="overline" tone="faint" style={{ marginTop: theme.spacing.xxl }}>
        Example — the code is 82
      </Text>
      <View style={{ marginTop: theme.spacing.md }}>
        <GuessRow index={0} guess="56" display="0" score={0} />
        <Text variant="caption" tone="faint" style={{ marginBottom: theme.spacing.lg }}>
          Neither digit appears in the code.
        </Text>

        <GuessRow index={1} guess="28" display="−2" score={-2} />
        <Text variant="caption" tone="faint" style={{ marginBottom: theme.spacing.lg }}>
          Both digits are correct, but both are in the wrong place.
        </Text>

        <GuessRow index={2} guess="82" display="+2" score={2} />
        <Text variant="caption" tone="faint">
          Both digits correct, both in the right place. Solved.
        </Text>
      </View>

      <Card style={{ marginTop: theme.spacing.xxl }}>
        <Text variant="bodyStrong">The Daily Challenge</Text>
        <Text variant="body" tone="muted" style={{ marginTop: theme.spacing.sm }}>
          One code a day, the same for every player in the world, one attempt.
          It resets at midnight UTC. Play any day to keep your streak alive —
          solving is worth more, but showing up is what counts.
        </Text>
      </Card>

      <Card style={{ marginTop: theme.spacing.lg }}>
        <Text variant="bodyStrong">A tip</Text>
        <Text variant="body" tone="muted" style={{ marginTop: theme.spacing.sm }}>
          A guess that rules out possibilities is worth more than a guess that
          might be lucky. The counter beside each row shows how many codes are
          still consistent with everything you know.
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
