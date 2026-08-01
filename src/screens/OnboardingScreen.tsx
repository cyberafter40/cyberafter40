import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { markOnboarded } from '@/services/storage';
import { Button, CodeSlots, GuessRow, Screen, Text } from '@/ui/components';
import { useTheme } from '@/ui/ThemeProvider';

interface Slide {
  title: string;
  body: string;
  render: () => React.ReactNode;
}

/**
 * Onboarding.
 *
 * Three screens, no account, no permission prompts. The goal is that the player
 * understands the ± feedback before they see a real puzzle — everything else
 * (levels, badges, leaderboards) is discovered later, once the game itself has
 * earned their attention.
 */
export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);

  const slides: Slide[] = [
    {
      title: 'A hidden code',
      body: 'Every round, MindCode hides a short number. Your job is to work out what it is.',
      render: () => <CodeSlots value="" length={2} />,
    },
    {
      title: 'Every guess tells you something',
      body: 'A digit in the right place scores +1. The right digit in the wrong place scores −1. A digit that is not in the code scores nothing.',
      render: () => (
        <View style={{ width: '100%' }}>
          <GuessRow index={0} guess="56" display="0" score={0} />
          <GuessRow index={1} guess="28" display="−2" score={-2} />
          <GuessRow index={2} guess="82" display="+2" score={2} />
        </View>
      ),
    },
    {
      title: 'Five minutes a day',
      body: 'One Daily Challenge, the same code for everyone in the world. Play each day to build a streak, earn XP and climb the ranks.',
      render: () => (
        <Text style={{ fontSize: 52 }} center>
          🔥
        </Text>
      ),
    },
  ];

  const slide = slides[index] as Slide;
  const isLast = index === slides.length - 1;

  const advance = () => {
    if (isLast) {
      void markOnboarded();
      onDone();
      return;
    }
    setIndex((current) => current + 1);
  };

  return (
    <Screen
      footer={
        <View>
          <Button label={isLast ? 'Start playing' : 'Next'} onPress={advance} />
          {!isLast ? (
            <Button
              label="Skip"
              variant="ghost"
              onPress={() => {
                void markOnboarded();
                onDone();
              }}
              style={{ marginTop: theme.spacing.sm }}
            />
          ) : null}
        </View>
      }
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Animated.View key={index} entering={FadeIn.duration(280)}>
          <View style={{ alignItems: 'center', marginBottom: theme.spacing.xxl }}>
            {slide.render()}
          </View>

          <Text variant="title" center>
            {slide.title}
          </Text>
          <Text
            variant="body"
            tone="muted"
            center
            style={{ marginTop: theme.spacing.md, paddingHorizontal: theme.spacing.md }}
          >
            {slide.body}
          </Text>
        </Animated.View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.sm }}>
        {slides.map((_, dot) => (
          <View
            key={dot}
            style={{
              width: dot === index ? 20 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: dot === index ? theme.colors.accent : theme.colors.border,
            }}
          />
        ))}
      </View>
    </Screen>
  );
}
