import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { GameRendererProps } from '@/games/renderers';
import { CodeSlots, GuessRow, Keypad, Text } from '@/ui/components';
import { errorFeedback, submitFeedback, successFeedback } from '@/ui/haptics';
import { useTheme } from '@/ui/ThemeProvider';
import { eliminatedDigits, type NumberLogicFeedback, type NumberLogicState } from './engine';
import { getFeedbackPolicy } from './policies';

/**
 * The play surface for Number Logic.
 *
 * Layout priorities, top to bottom: the code you are entering, the history you
 * are reasoning from, then the keypad under your thumb. History scrolls; the
 * slots and keypad never move, so the board feels like a fixed object rather
 * than a page.
 */
export function NumberPadBoard({ session, onFinished }: GameRendererProps) {
  const theme = useTheme();
  const state = session.state<NumberLogicState>();
  const { config } = state;
  const policy = getFeedbackPolicy(config.policyId);

  const [entry, setEntry] = useState('');

  const attemptsLeft = Math.max(0, config.maxAttempts - state.attempts.length);
  const eliminated = useMemo(
    () => eliminatedDigits(config, state.attempts),
    [config, state.attempts],
  );

  const pushDigit = useCallback(
    (digit: string) => {
      setEntry((current) => (current.length >= config.digits ? current : current + digit));
    },
    [config.digits],
  );

  const deleteDigit = useCallback(() => {
    setEntry((current) => current.slice(0, -1));
  }, []);

  const submit = useCallback(() => {
    if (entry.length !== config.digits) return;

    submitFeedback();
    const outcome = session.submitMove({ guess: entry });

    if (!outcome.accepted) {
      errorFeedback();
      return;
    }

    setEntry('');

    const feedback = outcome.feedback as NumberLogicFeedback | undefined;
    if (feedback?.solved) successFeedback();

    // `outcome.terminal`, not `session.isOver` — the latter is a render-time
    // snapshot taken before this move landed.
    if (outcome.terminal) {
      // Let the final row animate in before handing off to the result screen.
      setTimeout(onFinished, 520);
    }
  }, [entry, config.digits, session, onFinished]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', paddingVertical: theme.spacing.lg }}>
        <CodeSlots
          value={entry}
          length={config.digits}
          shakeToken={session.shakeToken}
          solved={session.status === 'won'}
        />

        <Text
          variant="caption"
          tone={session.errorMessage ? 'negative' : 'faint'}
          center
          style={{ marginTop: theme.spacing.md, height: 20 }}
        >
          {session.errorMessage ??
            `${attemptsLeft} guess${attemptsLeft === 1 ? '' : 'es'} left · ${policy.label}`}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: theme.spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {state.attempts.length === 0 ? (
          <Text variant="caption" tone="faint" center style={{ paddingVertical: theme.spacing.xl }}>
            Enter any {config.digits}-digit code to begin.{'\n'}
            Every answer narrows it down.
          </Text>
        ) : (
          [...state.attempts].reverse().map((attempt) => {
            const index = state.attempts.indexOf(attempt);
            return (
              <GuessRow
                key={`${attempt.guess}-${index}`}
                index={index}
                guess={attempt.guess}
                display={policy.format(attempt.score)}
                score={attempt.score}
                candidatesRemaining={attempt.candidatesRemaining}
                animateIn={index === state.attempts.length - 1}
              />
            );
          })
        )}
      </ScrollView>

      <Keypad
        onDigit={pushDigit}
        onDelete={deleteDigit}
        onSubmit={submit}
        canSubmit={entry.length === config.digits && !session.isOver}
        canDelete={entry.length > 0}
        disabled={session.isOver}
        eliminated={eliminated}
      />
    </View>
  );
}
