/**
 * Deterministic random numbers.
 *
 * Everything in eNis that is "random" comes from a seed, so the same world code
 * always produces the same planet. Each subsystem forks its own stream by name
 * (e.g. "terrain", "clouds"), so adding a new feature never changes the output
 * of an existing one.
 */

/** 32-bit FNV-1a hash of a string. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mixes two 32-bit integers into a new well-distributed 32-bit integer. */
export function mixSeeds(a: number, b: number): number {
  let h = (a ^ Math.imul(b, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Mulberry32: tiny, fast, good enough for games. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  readonly seed: number;
  private readonly nextFloat: () => number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.nextFloat = mulberry32(this.seed);
  }

  /** Independent stream for a named subsystem. */
  fork(label: string): Rng {
    return new Rng(mixSeeds(this.seed, hashString(label)));
  }

  /** Float in [0, 1). */
  next(): number {
    return this.nextFloat();
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.nextFloat();
  }

  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return min + Math.floor(this.nextFloat() * (max - min + 1));
  }

  chance(probability: number): boolean {
    return this.nextFloat() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.nextFloat() * items.length)];
  }

  /** Function form, handy for libraries that expect `() => number`. */
  get fn(): () => number {
    return this.nextFloat;
  }
}

/** A fresh random 32-bit seed (not deterministic, used for "new planet"). */
export function randomSeed(): number {
  try {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] >>> 0;
  } catch {
    return Math.floor(Math.random() * 0xffffffff) >>> 0;
  }
}
