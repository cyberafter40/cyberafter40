import { createRng } from '@/engine/rng';
import {
  deductionAccuracy,
  eliminatedDigits,
  numberLogicEngine,
  type NumberLogicState,
} from '@/games/numberLogic/engine';
import {
  codeSpaceSize,
  enumerateCodes,
  generateSecret,
  type NumberLogicConfig,
} from '@/games/numberLogic/generator';
import { isConsistentWithScore } from '@/games/numberLogic/matching';
import { getFeedbackPolicy } from '@/games/numberLogic/policies';

const config: NumberLogicConfig = {
  digits: 2,
  maxAttempts: 6,
  allowRepeatedDigits: false,
  allowLeadingZero: true,
  policyId: 'plus-minus',
};

function newGame(seed = 'test:seed', overrides: Partial<NumberLogicConfig> = {}) {
  return numberLogicEngine.createInitialState({
    config: { ...config, ...overrides },
    rng: createRng(seed),
    startedAt: 0,
  });
}

function play(state: NumberLogicState, guesses: string[]): NumberLogicState {
  let current = state;
  guesses.forEach((guess, index) => {
    current = numberLogicEngine.applyMove(current, { guess }, (index + 1) * 5_000).state;
  });
  return current;
}

describe('generator', () => {
  it('is fully determined by its seed', () => {
    expect(generateSecret(config, createRng('a'))).toBe(generateSecret(config, createRng('a')));
    expect(generateSecret(config, createRng('a'))).not.toBe(
      generateSecret(config, createRng('b')),
    );
  });

  it('respects the unique-digit and leading-zero constraints', () => {
    const strict: NumberLogicConfig = { ...config, digits: 3, allowLeadingZero: false };
    for (let i = 0; i < 200; i += 1) {
      const secret = generateSecret(strict, createRng(`seed-${i}`));
      expect(secret).toHaveLength(3);
      expect(secret.startsWith('0')).toBe(false);
      expect(new Set(secret).size).toBe(3);
    }
  });

  it('enumerates exactly as many codes as it claims', () => {
    const cases: NumberLogicConfig[] = [
      config,
      { ...config, digits: 3 },
      { ...config, digits: 3, allowLeadingZero: false },
      { ...config, digits: 2, allowRepeatedDigits: true },
    ];
    for (const candidate of cases) {
      expect(enumerateCodes(candidate)).toHaveLength(codeSpaceSize(candidate));
    }
  });

  it('declines to enumerate a space that is too large', () => {
    expect(enumerateCodes({ ...config, digits: 6, allowRepeatedDigits: true })).toBeNull();
  });
});

describe('numberLogicEngine', () => {
  it('starts in progress with no attempts', () => {
    const state = newGame();
    expect(state.status).toBe('in_progress');
    expect(state.attempts).toHaveLength(0);
    expect(numberLogicEngine.isTerminal(state)).toBe(false);
  });

  it('hides the solution until the game is over', () => {
    const state = newGame();
    expect(() => numberLogicEngine.revealSolution(state)).toThrow(/still in progress/);
  });

  it('marks the game won when the code is guessed', () => {
    const state = newGame();
    const solved = play(state, [state.secret]);

    expect(solved.status).toBe('won');
    expect(numberLogicEngine.isTerminal(solved)).toBe(true);
    expect(numberLogicEngine.revealSolution(solved)).toBe(state.secret);

    const outcome = numberLogicEngine.getOutcome(solved, 5_000);
    expect(outcome.status).toBe('won');
    expect(outcome.movesUsed).toBe(1);
    expect(outcome.durationMs).toBe(5_000);
  });

  it('ends as lost once the attempt budget is spent', () => {
    const state = newGame('lose', { maxAttempts: 2 });
    const wrong = enumerateCodes(state.config)!.filter((code) => code !== state.secret);

    const finished = play(state, [wrong[0] as string, wrong[1] as string]);
    expect(finished.status).toBe('lost');
    expect(numberLogicEngine.getOutcome(finished, 10_000).status).toBe('lost');
  });

  it('rejects malformed and repeated guesses', () => {
    const state = newGame();
    expect(numberLogicEngine.validateMove(state, { guess: '1' }).code).toBe('malformed');
    expect(numberLogicEngine.validateMove(state, { guess: 'ab' }).code).toBe('malformed');

    const afterGuess = play(state, ['12']);
    expect(numberLogicEngine.validateMove(afterGuess, { guess: '12' }).code).toBe('duplicate');
  });

  it('refuses moves once the game is terminal', () => {
    const solved = play(newGame(), [newGame().secret]);
    expect(numberLogicEngine.validateMove(solved, { guess: '99' }).code).toBe('game_over');
  });

  it('records abandonment without changing the attempt count', () => {
    const state = play(newGame(), ['12']);
    const abandoned = numberLogicEngine.abandon(state, 9_000);

    expect(abandoned.status).toBe('abandoned');
    expect(abandoned.attempts).toHaveLength(1);
    expect(numberLogicEngine.getOutcome(abandoned, 9_000).status).toBe('abandoned');
  });

  it('narrows the candidate set monotonically', () => {
    const state = newGame('narrowing', { digits: 3 });
    const played = play(state, ['012', '345', '678']);

    const counts = played.attempts.map((a) => a.candidatesRemaining as number);
    expect(counts.every((count) => count >= 1)).toBe(true);
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i] as number).toBeLessThanOrEqual(counts[i - 1] as number);
    }
  });

  it('always leaves the real secret in the candidate set', () => {
    const state = newGame('candidates', { digits: 3 });
    const played = play(state, ['012', '345']);
    const policy = getFeedbackPolicy(played.config.policyId);

    const survivors = enumerateCodes(played.config)!.filter((candidate) =>
      played.attempts.every((attempt) =>
        isConsistentWithScore(candidate, attempt.guess, attempt.score, policy),
      ),
    );

    expect(survivors).toContain(state.secret);
    expect(played.attempts[played.attempts.length - 1]?.candidatesRemaining).toBe(
      survivors.length,
    );
  });

  it('is fully replayable from its seed', () => {
    const a = play(newGame('replay'), ['12', '34']);
    const b = play(newGame('replay'), ['12', '34']);
    expect(b.secret).toBe(a.secret);
    expect(b.attempts).toEqual(a.attempts);
  });
});

describe('deductionAccuracy', () => {
  it('is 0 before any guess and 1 for an immediate solve', () => {
    const state = newGame('accuracy');
    expect(deductionAccuracy(state)).toBe(0);
    expect(deductionAccuracy(play(state, [state.secret]))).toBeCloseTo(1, 5);
  });

  it('stays within 0..1 for an ordinary game', () => {
    const state = newGame('bounds', { digits: 3 });
    const played = play(state, ['012', '345', '678', state.secret]);
    const accuracy = deductionAccuracy(played);
    expect(accuracy).toBeGreaterThan(0);
    expect(accuracy).toBeLessThanOrEqual(1);
  });
});

describe('eliminatedDigits', () => {
  it('finds nothing before the first guess', () => {
    expect(eliminatedDigits(config, []).size).toBe(0);
  });

  it('never eliminates a digit that is actually in the code', () => {
    const state = newGame('elimination', { digits: 3 });
    const played = play(state, ['012', '345']);
    const eliminated = eliminatedDigits(played.config, played.attempts);

    for (const digit of state.secret) {
      expect(eliminated.has(digit)).toBe(false);
    }
  });
});
