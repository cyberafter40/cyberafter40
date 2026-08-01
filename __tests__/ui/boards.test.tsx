import React from 'react';
import { createRng } from '@/engine/rng';
import { getVariant } from '@/engine/registry';
import { MemoryGridBoard } from '@/games/memoryGrid/MemoryGridBoard';
import { generateSequence } from '@/games/memoryGrid/generator';
import { NumberPadBoard } from '@/games/numberLogic/NumberPadBoard';
import { generateSecret } from '@/games/numberLogic/generator';
import { useGameSession } from '@/state/useGameSession';
import { act, fireEvent, makeProfile, renderWithProviders, screen } from './helpers';

/**
 * Play-surface tests — the real integration point.
 *
 * These render the *actual* board driven by the *actual* `useGameSession` and
 * the *actual* engine. Nothing about the game is faked: the secret is derived
 * from the seed the same way the app derives it, so pressing the right keys
 * really does win. Only the profile (which comes from Firestore) is injected.
 *
 * This is the layer the rest of the test pyramid could not reach: an engine
 * unit test cannot tell you that a keypad is wired to the wrong handler, that a
 * board never calls `onFinished`, or that a reveal animation leaves the grid
 * permanently untappable.
 */

const mockProfileValue = {
  profile: makeProfile(),
  loading: false,
  syncError: null,
  streak: 0,
  applyLocalProfile: jest.fn(),
  updateSettings: jest.fn(),
  updateProfileIdentity: jest.fn(),
};

jest.mock('@/state/ProfileContext', () => ({
  __esModule: true,
  // The profile is a data-supply boundary, exactly like the Firestore mocks.
  useProfile: () => mockProfileValue,
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));

/* ---------------- Number Logic ---------------- */

const NUMBER_SEED = 'ui-test:number';

function numberSecret(variantId: string): string {
  const variant = getVariant('number-logic', variantId);
  return generateSecret(variant.config, createRng(NUMBER_SEED));
}

function NumberHarness({ onFinished }: { onFinished: () => void }) {
  const session = useGameSession({
    sessionId: 'ui-number-session',
    moduleId: 'number-logic',
    variantId: 'two-digit',
    mode: 'classic',
    seed: NUMBER_SEED,
  });
  return <NumberPadBoard session={session} onFinished={onFinished} />;
}

function typeCode(code: string): void {
  for (const digit of code) {
    fireEvent.press(screen.getByRole('button', { name: digit }));
  }
}

describe('NumberPadBoard', () => {
  const secret = numberSecret('two-digit');

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('shows the entered digits in the code slots before submitting', () => {
    renderWithProviders(<NumberHarness onFinished={jest.fn()} />);

    typeCode('47');
    expect(screen.getByLabelText('Entered 4 7')).toBeTruthy();
  });

  it('will not submit an incomplete code', () => {
    renderWithProviders(<NumberHarness onFinished={jest.fn()} />);

    fireEvent.press(screen.getByRole('button', { name: '4' }));
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });

  it('deletes the last digit', () => {
    renderWithProviders(<NumberHarness onFinished={jest.fn()} />);

    typeCode('47');
    fireEvent.press(screen.getByRole('button', { name: '⌫' }));
    expect(screen.getByLabelText('Entered 4')).toBeTruthy();
  });

  it('records a guess in the history with its feedback score', () => {
    const wrong = secret === '10' ? '23' : '10';
    renderWithProviders(<NumberHarness onFinished={jest.fn()} />);

    typeCode(wrong);
    fireEvent.press(screen.getByRole('button', { name: 'Check' }));

    // The row exists, labelled for a screen reader, and the slots have cleared.
    expect(screen.getByLabelText(new RegExp(`Guess 1, ${wrong.split('').join(' ')}`))).toBeTruthy();
    expect(screen.getByLabelText('Empty code, 2 digits')).toBeTruthy();
  });

  it('refuses a repeated guess and says why', () => {
    const wrong = secret === '10' ? '23' : '10';
    renderWithProviders(<NumberHarness onFinished={jest.fn()} />);

    typeCode(wrong);
    fireEvent.press(screen.getByRole('button', { name: 'Check' }));
    typeCode(wrong);
    fireEvent.press(screen.getByRole('button', { name: 'Check' }));

    expect(screen.getByText('You already tried that code.')).toBeTruthy();
  });

  it('counts down the remaining guesses', () => {
    const wrong = secret === '10' ? '23' : '10';
    renderWithProviders(<NumberHarness onFinished={jest.fn()} />);

    expect(screen.getByText(/6 guesses left/)).toBeTruthy();
    typeCode(wrong);
    fireEvent.press(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText(/5 guesses left/)).toBeTruthy();
  });

  it('wins on the correct code, then hands off to the result screen', () => {
    const onFinished = jest.fn();
    renderWithProviders(<NumberHarness onFinished={onFinished} />);

    typeCode(secret);
    fireEvent.press(screen.getByRole('button', { name: 'Check' }));

    // The hand-off is deliberately delayed so the final row can land.
    expect(onFinished).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('locks the keypad once the game is over', () => {
    renderWithProviders(<NumberHarness onFinished={jest.fn()} />);

    typeCode(secret);
    fireEvent.press(screen.getByRole('button', { name: 'Check' }));

    expect(screen.getByRole('button', { name: '1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });
});

/* ---------------- Memory Grid ---------------- */

const MEMORY_SEED = 'ui-test:memory';
const MEMORY_VARIANT = 'short';

function memorySequence(): number[] {
  const variant = getVariant('memory-grid', MEMORY_VARIANT);
  return generateSequence(variant.config, createRng(MEMORY_SEED));
}

function MemoryHarness({ onFinished }: { onFinished: () => void }) {
  const session = useGameSession({
    sessionId: 'ui-memory-session',
    moduleId: 'memory-grid',
    variantId: MEMORY_VARIANT,
    mode: 'classic',
    seed: MEMORY_SEED,
  });
  return <MemoryGridBoard session={session} onFinished={onFinished} />;
}

/** Runs out the reveal animation so the grid becomes tappable. */
function finishReveal(): void {
  const { config } = getVariant('memory-grid', MEMORY_VARIANT);
  const total = 500 + config.sequenceLength * (config.revealMs + 220) + 50;
  act(() => {
    jest.advanceTimersByTime(total);
  });
}

function tapTile(tile: number): void {
  fireEvent.press(screen.getByRole('button', { name: `Tile ${tile + 1}` }));
}

describe('MemoryGridBoard', () => {
  const sequence = memorySequence();

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('starts in the watch phase with the grid locked', () => {
    renderWithProviders(<MemoryHarness onFinished={jest.fn()} />);

    expect(screen.getByText('Watch')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tile 1' })).toBeDisabled();
  });

  it('ignores taps made during the reveal, so nothing is lost by fidgeting', () => {
    renderWithProviders(<MemoryHarness onFinished={jest.fn()} />);

    tapTile(sequence[0] as number);
    tapTile(sequence[1] as number);

    finishReveal();
    // Progress is still zero: the taps were not counted.
    expect(screen.getByText(/0 of 4/)).toBeTruthy();
  });

  it('unlocks the grid once the sequence has played', () => {
    renderWithProviders(<MemoryHarness onFinished={jest.fn()} />);

    finishReveal();
    expect(screen.getByText('Repeat it')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tile 1' })).toBeEnabled();
  });

  it('advances progress on a correct tap', () => {
    renderWithProviders(<MemoryHarness onFinished={jest.fn()} />);
    finishReveal();

    tapTile(sequence[0] as number);
    expect(screen.getByText(/1 of 4/)).toBeTruthy();
  });

  it('spends a mistake on a wrong tap without losing progress', () => {
    renderWithProviders(<MemoryHarness onFinished={jest.fn()} />);
    finishReveal();

    tapTile(sequence[0] as number);
    const wrong = (sequence[1] as number) === 0 ? 1 : 0;
    tapTile(wrong === (sequence[1] as number) ? wrong + 1 : wrong);

    expect(screen.getByText(/1 of 4/)).toBeTruthy();
    expect(screen.getByText(/mistake/)).toBeTruthy();
  });

  it('wins on the full sequence, then hands off', () => {
    const onFinished = jest.fn();
    renderWithProviders(<MemoryHarness onFinished={onFinished} />);
    finishReveal();

    for (const tile of sequence) tapTile(tile);

    expect(onFinished).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(700);
    });
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('locks the grid again once the game is over', () => {
    renderWithProviders(<MemoryHarness onFinished={jest.fn()} />);
    finishReveal();

    for (const tile of sequence) tapTile(tile);

    expect(screen.getByRole('button', { name: 'Tile 1' })).toBeDisabled();
  });

  it('cleans up its timers when unmounted mid-reveal', () => {
    const onFinished = jest.fn();
    const { unmount } = renderWithProviders(<MemoryHarness onFinished={onFinished} />);

    // A player who quits during the reveal must not leave timers running that
    // fire into an unmounted tree.
    unmount();
    act(() => {
      jest.advanceTimersByTime(20_000);
    });
    expect(onFinished).not.toHaveBeenCalled();
  });
});
