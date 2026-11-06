/**
 * Inheritance. Hair color follows two alleles, one from each parent, where
 * darker colors are dominant: red hair can skip a generation and come back
 * in a grandchild. Skin, height and character are roughly the parents'
 * average plus some chance.
 */
import { CLOTH_COLORS, TRAITS, type Look } from './types';

export interface RandomSource {
  next(): number;
  range(a: number, b: number): number;
  int(a: number, b: number): number;
  chance(p: number): boolean;
}

/** Number of hair alleles (0 black … 5 red). */
export const HAIR_ALLELES = 6;

/** How common each allele is among the first people. */
const FOUNDER_ALLELES = [0.2, 0.25, 0.2, 0.1, 0.13, 0.12];

/** The color two alleles show: the dominant (lower) one. */
export function expressHair(genes: readonly [number, number]): number {
  return Math.min(genes[0], genes[1]);
}

function founderAllele(rng: RandomSource): number {
  let r = rng.next();
  for (let i = 0; i < FOUNDER_ALLELES.length; i++) {
    r -= FOUNDER_ALLELES[i];
    if (r < 0) return i;
  }
  return 0;
}

/** Roughly bell-shaped around 0, from −1 to 1. */
function bell(rng: RandomSource): number {
  return (rng.next() + rng.next() + rng.next()) / 1.5 - 1;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export function founderLook(rng: RandomSource, male: boolean): Look {
  const genes: [number, number] = [founderAllele(rng), founderAllele(rng)];
  return {
    skin: rng.next(),
    hair: expressHair(genes),
    height: rng.range(0.9, 1.1) * (male ? 1.04 : 0.97),
    clothes: Math.floor(rng.next() * CLOTH_COLORS.length),
    genes,
  };
}

export function childLook(rng: RandomSource, mother: Look, father: Look, male: boolean): Look {
  const genes: [number, number] = [mother.genes[rng.chance(0.5) ? 0 : 1], father.genes[rng.chance(0.5) ? 0 : 1]];
  // Height without the parents' sex difference, then this child's own.
  const base = (mother.height / 0.97 + father.height / 1.04) / 2;
  return {
    skin: clamp((mother.skin + father.skin) / 2 + bell(rng) * 0.08, 0, 1),
    hair: expressHair(genes),
    height: clamp(base + bell(rng) * 0.04, 0.86, 1.14) * (male ? 1.04 : 0.97),
    clothes: rng.chance(0.5) ? mother.clothes : Math.floor(rng.next() * CLOTH_COLORS.length),
    genes,
  };
}

/** Random character for someone made by you: mostly middling, some strong traits. */
export function randomTraits(rng: RandomSource): number[] {
  return TRAITS.map(() => Math.round(clamp(50 + bell(rng) * 45, 0, 100)));
}

/** About the parents' average, plus chance. */
export function childTraits(rng: RandomSource, a: readonly number[], b: readonly number[]): number[] {
  return TRAITS.map((_, i) => Math.round(clamp((a[i] + b[i]) / 2 + bell(rng) * 22, 0, 100)));
}

/** Deterministic stand-in values from an id (to upgrade data from older versions). */
export function hashUnit(n: number, salt: number): number {
  let h = Math.imul((n + 1) ^ Math.imul(salt + 7, 0x9e3779b9), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
