/**
 * Deterministic, seedable pseudo-random number generator.
 *
 * Every generated puzzle in MindCode is a pure function of a seed string. That
 * gives us three properties we need:
 *
 *  1. The Daily Challenge is identical for every user worldwide, because the
 *     seed is derived from the UTC date.
 *  2. The server can re-derive the exact same puzzle a client claims to have
 *     played, which is how `submitGameResult` validates scores without trusting
 *     the client.
 *  3. Games are reproducible in tests and in bug reports.
 *
 * `Math.random()` is intentionally never used inside a game engine.
 */

/** cyrb128 — string → four 32-bit seed words. */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;

  for (let i = 0; i < str.length; i += 1) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];
}

/** mulberry32 — fast 32-bit PRNG with a decent period for puzzle generation. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max] inclusive. */
  nextInt(min: number, max: number): number;
  /** Uniformly picks one element. Throws on an empty list. */
  pick<T>(items: readonly T[]): T;
  /** Fisher–Yates copy — the input array is not mutated. */
  shuffle<T>(items: readonly T[]): T[];
}

export function createRng(seed: string): Rng {
  const [s] = cyrb128(seed);
  const next = mulberry32(s);

  const nextInt = (min: number, max: number): number => {
    if (max < min) throw new RangeError(`nextInt: max (${max}) < min (${min})`);
    return min + Math.floor(next() * (max - min + 1));
  };

  return {
    next,
    nextInt,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError('pick: empty collection');
      return items[nextInt(0, items.length - 1)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = nextInt(0, i);
        const a = out[i] as T;
        out[i] = out[j] as T;
        out[j] = a;
      }
      return out;
    },
  };
}

/**
 * Canonical seed builder. Keeping seed construction in one place means the
 * client and the Cloud Function cannot drift apart.
 *
 * @example buildSeed('daily', '2026-08-01', 'number-logic', 'three-digit')
 */
export function buildSeed(...parts: (string | number)[]): string {
  return parts.map((p) => String(p)).join(':');
}
