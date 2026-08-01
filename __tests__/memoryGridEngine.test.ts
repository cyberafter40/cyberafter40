import { createRng } from '@/engine/rng';
import { memoryGridEngine, nextExpectedTile, type MemoryGridState } from '@/games/memoryGrid/engine';
import {
  generateSequence,
  isValidTile,
  tapBudget,
  type MemoryGridConfig,
} from '@/games/memoryGrid/generator';

const config: MemoryGridConfig = {
  size: 3,
  sequenceLength: 4,
  maxMistakes: 2,
  revealMs: 600,
};

function newGame(seed = 'memory:seed', overrides: Partial<MemoryGridConfig> = {}) {
  return memoryGridEngine.createInitialState({
    config: { ...config, ...overrides },
    rng: createRng(seed),
    startedAt: 0,
  });
}

function tap(state: MemoryGridState, tiles: number[]): MemoryGridState {
  let current = state;
  tiles.forEach((tile, index) => {
    current = memoryGridEngine.applyMove(current, { tile }, (index + 1) * 1_000).state;
  });
  return current;
}

/** A tile that is definitely wrong at the current position. */
function wrongTile(state: MemoryGridState): number {
  const expected = nextExpectedTile(state);
  const tiles = state.config.size * state.config.size;
  for (let tile = 0; tile < tiles; tile += 1) {
    if (tile !== expected) return tile;
  }
  throw new Error('grid too small to produce a wrong tile');
}

describe('generator', () => {
  it('is fully determined by its seed', () => {
    expect(generateSequence(config, createRng('a'))).toEqual(
      generateSequence(config, createRng('a')),
    );
    expect(generateSequence(config, createRng('a'))).not.toEqual(
      generateSequence(config, createRng('b')),
    );
  });

  it('produces in-range tiles and never repeats one back to back', () => {
    for (let i = 0; i < 200; i += 1) {
      const sequence = generateSequence({ ...config, sequenceLength: 9 }, createRng(`s${i}`));
      expect(sequence).toHaveLength(9);
      sequence.forEach((tile, index) => {
        expect(isValidTile(tile, config)).toBe(true);
        if (index > 0) expect(tile).not.toBe(sequence[index - 1]);
      });
    }
  });

  it('rejects a configuration it cannot satisfy', () => {
    expect(() => generateSequence({ ...config, size: 1 }, createRng('x'))).toThrow(/size/);
    expect(() => generateSequence({ ...config, sequenceLength: 0 }, createRng('x'))).toThrow(
      /sequenceLength/,
    );
  });
});

describe('memoryGridEngine', () => {
  it('starts in progress with nothing recalled', () => {
    const state = newGame();
    expect(state.status).toBe('in_progress');
    expect(state.entered).toHaveLength(0);
    expect(state.taps).toBe(0);
    expect(memoryGridEngine.isTerminal(state)).toBe(false);
  });

  it('hides the sequence until the game is over', () => {
    expect(() => memoryGridEngine.revealSolution(newGame())).toThrow(/still in progress/);
  });

  it('is won by reproducing the whole sequence', () => {
    const state = newGame();
    const solved = tap(state, state.sequence);

    expect(solved.status).toBe('won');
    expect(solved.mistakes).toBe(0);
    expect(memoryGridEngine.revealSolution(solved)).toBe(state.sequence.join('-'));

    const outcome = memoryGridEngine.getOutcome(solved, 4_000);
    expect(outcome.status).toBe('won');
    expect(outcome.movesUsed).toBe(config.sequenceLength);
    expect(outcome.accuracy).toBe(1);
    expect(outcome.metrics.mistakes).toBe(0);
  });

  it('counts a wrong tap as a mistake without losing progress', () => {
    const state = newGame();
    const afterOne = tap(state, [state.sequence[0] as number]);
    const afterMistake = tap(afterOne, [wrongTile(afterOne)]);

    expect(afterMistake.mistakes).toBe(1);
    expect(afterMistake.entered).toHaveLength(1);
    expect(afterMistake.status).toBe('in_progress');
    // The same tile is still the one expected next.
    expect(nextExpectedTile(afterMistake)).toBe(nextExpectedTile(afterOne));
  });

  it('is lost once the mistake allowance is exceeded', () => {
    let state = newGame();
    for (let i = 0; i <= config.maxMistakes; i += 1) {
      state = tap(state, [wrongTile(state)]);
    }

    expect(state.status).toBe('lost');
    expect(memoryGridEngine.getOutcome(state, 5_000).status).toBe('lost');
  });

  it('can still be won after using some of the mistake allowance', () => {
    const state = newGame();
    const stumbled = tap(state, [wrongTile(state)]);
    const solved = tap(stumbled, state.sequence);

    expect(solved.status).toBe('won');
    expect(solved.mistakes).toBe(1);
    expect(memoryGridEngine.getOutcome(solved, 6_000).accuracy).toBeCloseTo(4 / 5, 5);
  });

  it('rejects taps off the grid and after the game ends', () => {
    const state = newGame();
    expect(memoryGridEngine.validateMove(state, { tile: -1 }).code).toBe('out_of_range');
    expect(memoryGridEngine.validateMove(state, { tile: 9 }).code).toBe('out_of_range');
    expect(memoryGridEngine.validateMove(state, { tile: 1.5 }).code).toBe('out_of_range');

    const solved = tap(state, state.sequence);
    expect(memoryGridEngine.validateMove(solved, { tile: 0 }).code).toBe('game_over');
  });

  it('records abandonment without inventing progress', () => {
    const state = tap(newGame(), [newGame().sequence[0] as number]);
    const abandoned = memoryGridEngine.abandon(state, 9_000);

    expect(abandoned.status).toBe('abandoned');
    expect(abandoned.entered).toHaveLength(1);
    expect(memoryGridEngine.getOutcome(abandoned, 9_000).status).toBe('abandoned');
  });

  it('reports a move budget the scoring engine can reason about', () => {
    const outcome = memoryGridEngine.getOutcome(tap(newGame(), newGame().sequence), 4_000);
    expect(outcome.maxMoves).toBe(tapBudget(config));
  });

  it('keeps accuracy inside 0..1 in every terminal state', () => {
    const cases = [
      tap(newGame(), newGame().sequence), // won
      (() => {
        let s = newGame('lose');
        for (let i = 0; i <= config.maxMistakes; i += 1) s = tap(s, [wrongTile(s)]);
        return s;
      })(), // lost
      memoryGridEngine.abandon(newGame('quit'), 3_000), // abandoned
    ];

    for (const state of cases) {
      const { accuracy } = memoryGridEngine.getOutcome(state, 10_000);
      expect(accuracy).toBeGreaterThanOrEqual(0);
      expect(accuracy).toBeLessThanOrEqual(1);
    }
  });

  it('is fully replayable from its seed', () => {
    const a = tap(newGame('replay'), [0, 1]);
    const b = tap(newGame('replay'), [0, 1]);
    expect(b.sequence).toEqual(a.sequence);
    expect(b.entered).toEqual(a.entered);
    expect(b.taps).toBe(a.taps);
  });

  it('produces JSON-serialisable state, so a session can be persisted', () => {
    const state = tap(newGame(), [0]);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
