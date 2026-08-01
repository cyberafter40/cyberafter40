import type { Rng } from '@/engine/rng';

/** Variant configuration for the memory-grid engine. */
export interface MemoryGridConfig {
  /** The grid is `size × size` tiles. */
  size: number;
  /** How many tiles light up, in order. */
  sequenceLength: number;
  /** Wrong taps allowed before the game is lost. */
  maxMistakes: number;
  /** How long each tile stays lit during the reveal. Read by the renderer. */
  revealMs: number;
}

/**
 * Builds the sequence to memorise.
 *
 * Deterministic from the seeded RNG, exactly like the number game's secret —
 * which is what lets the Daily Challenge be identical worldwide and lets the
 * backend re-derive the sequence to check a submitted result.
 *
 * Consecutive repeats are avoided: a tile flashing twice in a row is ambiguous
 * to watch, so it tests eyesight rather than memory.
 */
export function generateSequence(config: MemoryGridConfig, rng: Rng): number[] {
  assertSatisfiable(config);

  const tileCount = config.size * config.size;
  const sequence: number[] = [];

  for (let i = 0; i < config.sequenceLength; i += 1) {
    const previous = sequence[i - 1];
    let tile = rng.nextInt(0, tileCount - 1);
    if (tileCount > 1) {
      while (tile === previous) tile = rng.nextInt(0, tileCount - 1);
    }
    sequence.push(tile);
  }

  return sequence;
}

export function isValidTile(tile: unknown, config: MemoryGridConfig): boolean {
  return (
    typeof tile === 'number' &&
    Number.isInteger(tile) &&
    tile >= 0 &&
    tile < config.size * config.size
  );
}

/** Total taps a player is allowed before the game ends one way or the other. */
export function tapBudget(config: MemoryGridConfig): number {
  return config.sequenceLength + config.maxMistakes;
}

function assertSatisfiable(config: MemoryGridConfig): void {
  if (config.size < 2) throw new Error('MemoryGrid: `size` must be at least 2');
  if (config.sequenceLength < 1) {
    throw new Error('MemoryGrid: `sequenceLength` must be at least 1');
  }
  if (config.maxMistakes < 0) {
    throw new Error('MemoryGrid: `maxMistakes` cannot be negative');
  }
}
