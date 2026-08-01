import React from 'react';
import { Button } from '@/ui/components/Button';
import { CodeSlots } from '@/ui/components/CodeSlots';
import { GuessRow } from '@/ui/components/GuessRow';
import { Keypad } from '@/ui/components/Keypad';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { StatTile } from '@/ui/components/StatTile';
import { fireEvent, renderWithProviders, screen } from './helpers';

/**
 * Component-level tests.
 *
 * These assert the two things a design system has to get right and that types
 * cannot check: that a component is *reachable* (accessibility role, label and
 * disabled state) and that it *communicates* (the score pill's sign, the
 * locked/unlocked treatment). Pixel styling is deliberately not asserted —
 * that would break on every design tweak without catching a real defect.
 */

describe('Button', () => {
  it('fires its handler and exposes a button role', () => {
    const onPress = jest.fn();
    renderWithProviders(<Button label="Play today’s code" onPress={onPress} />);

    fireEvent.press(screen.getByRole('button', { name: 'Play today’s code' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire while disabled', () => {
    const onPress = jest.fn();
    renderWithProviders(<Button label="Check" onPress={onPress} disabled />);

    fireEvent.press(screen.getByRole('button', { name: 'Check' }));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });

  it('does not fire while loading, and hides its label behind a spinner', () => {
    const onPress = jest.fn();
    renderWithProviders(<Button label="Create account" onPress={onPress} loading />);

    const button = screen.getByRole('button');
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.queryByText('Create account')).toBeNull();
  });
});

describe('CodeSlots', () => {
  it('renders one slot per digit and shows what has been entered', () => {
    renderWithProviders(<CodeSlots value="82" length={3} />);

    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByLabelText('Entered 8 2')).toBeTruthy();
  });

  it('announces an empty code rather than reading as blank', () => {
    renderWithProviders(<CodeSlots value="" length={3} />);
    expect(screen.getByLabelText('Empty code, 3 digits')).toBeTruthy();
  });
});

describe('GuessRow', () => {
  it('labels the whole row for a screen reader', () => {
    renderWithProviders(<GuessRow index={1} guess="56" display="0" score={0} />);
    expect(screen.getByLabelText('Guess 2, 5 6, result 0')).toBeTruthy();
  });

  it('renders the policy-formatted score, signs included', () => {
    renderWithProviders(<GuessRow index={0} guess="28" display="−2" score={-2} />);
    // The minus sign must survive to the screen: it is the entire feedback.
    expect(screen.getByText('−2')).toBeTruthy();
  });

  it('shows the remaining-candidate count only when it is known', () => {
    const { rerender } = renderWithProviders(
      <GuessRow index={0} guess="12" display="+1" score={1} candidatesRemaining={14} />,
    );
    expect(screen.getByText('14 left')).toBeTruthy();

    rerender(<GuessRow index={0} guess="12" display="+1" score={1} candidatesRemaining={null} />);
    expect(screen.queryByText(/left/)).toBeNull();
  });
});

describe('Keypad', () => {
  const setup = (overrides: Partial<React.ComponentProps<typeof Keypad>> = {}) => {
    const props = {
      onDigit: jest.fn(),
      onDelete: jest.fn(),
      onSubmit: jest.fn(),
      canSubmit: true,
      canDelete: true,
      submitLabel: 'Check',
      ...overrides,
    };
    renderWithProviders(<Keypad {...props} />);
    return props;
  };

  it('offers every digit and reports which was pressed', () => {
    const props = setup();
    for (const digit of '0123456789') {
      fireEvent.press(screen.getByRole('button', { name: digit }));
    }
    expect(props.onDigit).toHaveBeenCalledTimes(10);
    expect(props.onDigit).toHaveBeenCalledWith('7');
  });

  it('disables submit and delete when there is nothing to act on', () => {
    const props = setup({ canSubmit: false, canDelete: false });

    fireEvent.press(screen.getByRole('button', { name: 'Check' }));
    fireEvent.press(screen.getByRole('button', { name: '⌫' }));

    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it('keeps eliminated digits tappable — thinking aloud is allowed', () => {
    const props = setup({ eliminated: new Set(['3', '7']) });

    fireEvent.press(screen.getByRole('button', { name: '3' }));
    expect(props.onDigit).toHaveBeenCalledWith('3');
  });

  it('locks the whole pad once the game is over', () => {
    const props = setup({ disabled: true });

    fireEvent.press(screen.getByRole('button', { name: '1' }));
    fireEvent.press(screen.getByRole('button', { name: 'Check' }));

    expect(props.onDigit).not.toHaveBeenCalled();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});

describe('ProgressBar', () => {
  it('reports its value to assistive technology', () => {
    renderWithProviders(<ProgressBar value={0.42} accessibilityLabel="Level 3 progress" />);

    const bar = screen.getByRole('progressbar', { name: 'Level 3 progress' });
    expect(bar).toHaveAccessibilityValue({ min: 0, max: 100, now: 42 });
  });

  it('clamps a value above 1 rather than overflowing the track', () => {
    renderWithProviders(<ProgressBar value={9} accessibilityLabel="over" />);
    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({ now: 100 });
  });

  it('treats a NaN value as zero rather than rendering nothing', () => {
    renderWithProviders(<ProgressBar value={Number.NaN} accessibilityLabel="nan" />);
    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({ now: 0 });
  });
});

describe('StatTile', () => {
  it('reads as one summary rather than three loose strings', () => {
    renderWithProviders(<StatTile label="Best score" value="620" hint="best 9" />);
    expect(screen.getByLabelText('Best score: 620, best 9')).toBeTruthy();
  });
});

describe('SegmentedControl', () => {
  it('marks the active tab and switches on press', () => {
    const onChange = jest.fn();
    renderWithProviders(
      <SegmentedControl
        value="daily"
        onChange={onChange}
        options={[
          { value: 'daily', label: 'Today' },
          { value: 'global', label: 'All time' },
        ]}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Today' })).toBeSelected();

    fireEvent.press(screen.getByRole('tab', { name: 'All time' }));
    expect(onChange).toHaveBeenCalledWith('global');
  });

  it('does not re-fire when the active tab is pressed again', () => {
    const onChange = jest.fn();
    renderWithProviders(
      <SegmentedControl
        value="daily"
        onChange={onChange}
        options={[
          { value: 'daily', label: 'Today' },
          { value: 'global', label: 'All time' },
        ]}
      />,
    );

    fireEvent.press(screen.getByRole('tab', { name: 'Today' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
