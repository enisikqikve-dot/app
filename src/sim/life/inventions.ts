/**
 * The knowledge net of the Stone Age. There is no fixed order: each
 * invention needs others first, and whether and when someone has the idea
 * depends on opportunity, need, the person and chance.
 *
 * Knowledge lives in people's heads (a bit mask per person). It is passed on
 * by talking and teaching, and it is lost when the last person who knows it
 * dies.
 */
import { Biome } from '../planet/biomes';

export const INVENTION_IDS = ['tools', 'fire', 'spear', 'clothing', 'song', 'shelter', 'fishing', 'herbs', 'bow', 'pottery', 'burial'] as const;
export type InventionId = (typeof INVENTION_IDS)[number];

export const BIT: Record<InventionId, number> = Object.fromEntries(INVENTION_IDS.map((id, i) => [id, 1 << i])) as Record<InventionId, number>;

export interface Invention {
  id: InventionId;
  /** Inventions that must be known first. */
  needs: InventionId[];
  /** Chance per adult and year in the best case (before need, opportunity and person). */
  rate: number;
}

export const INVENTIONS: Record<InventionId, Invention> = {
  tools: { id: 'tools', needs: [], rate: 0.008 },
  fire: { id: 'fire', needs: ['tools'], rate: 0.0003 },
  spear: { id: 'spear', needs: ['tools'], rate: 0.0005 },
  herbs: { id: 'herbs', needs: [], rate: 0.0002 },
  song: { id: 'song', needs: ['fire'], rate: 0.00025 },
  clothing: { id: 'clothing', needs: ['tools', 'spear'], rate: 0.00025 },
  shelter: { id: 'shelter', needs: ['tools', 'fire'], rate: 0.0002 },
  fishing: { id: 'fishing', needs: ['spear'], rate: 0.00025 },
  burial: { id: 'burial', needs: ['song'], rate: 0.00015 },
  bow: { id: 'bow', needs: ['spear', 'clothing'], rate: 0.0001 },
  pottery: { id: 'pottery', needs: ['fire', 'shelter'], rate: 0.00008 },
};

export function maskOf(ids: readonly InventionId[]): number {
  let m = 0;
  for (const id of ids) m |= BIT[id];
  return m;
}

export function knows(mask: number, id: InventionId): boolean {
  return (mask & BIT[id]) !== 0;
}

/** Inventions whose prerequisites are all known, but which are not known yet. */
export function nextSteps(mask: number): InventionId[] {
  return INVENTION_IDS.filter((id) => !knows(mask, id) && INVENTIONS[id].needs.every((n) => knows(mask, n)));
}

export function listOf(mask: number): InventionId[] {
  return INVENTION_IDS.filter((id) => knows(mask, id));
}

export function countBits(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

/** What a place offers for an idea (stone, water, lightning …), 0.3 … 3. */
export interface Circumstances {
  /** Mountains or rocky beaches nearby. */
  stone: boolean;
  /** River, lake or coast nearby. */
  water: boolean;
  /** Forest around. */
  forest: boolean;
  /** A fire or lightning strike nearby recently. */
  flames: boolean;
  /** It is cold here (°C, now). */
  temperature: number;
  /** Someone in the group is sick. */
  sickness: boolean;
  /** The group is hungry (0 … 1). */
  hunger: number;
  /** Rain or storm now. */
  weather: boolean;
  /** Someone died recently. */
  mourning: boolean;
}

/** Opportunity × need for one invention in these circumstances. */
export function circumstanceFactor(id: InventionId, c: Circumstances): number {
  const cold = c.temperature < 4 ? 2.5 : c.temperature < 10 ? 1.6 : 0.6;
  switch (id) {
    case 'tools':
      return c.stone ? 2 : 0.6;
    case 'fire':
      return (c.flames ? 12 : 1) * cold;
    case 'spear':
      return 0.6 + c.hunger * 2.5;
    case 'clothing':
      return cold * 1.4;
    case 'song':
      return 1;
    case 'shelter':
      return cold * (c.weather ? 1.8 : 1);
    case 'fishing':
      return c.water ? 1.6 + c.hunger * 2 : 0;
    case 'herbs':
      return (c.forest ? 1.5 : 0.5) * (c.sickness ? 3 : 1);
    case 'bow':
      return 0.8 + c.hunger * 1.5;
    case 'pottery':
      return c.water ? 1.4 : 0.4;
    case 'burial':
      return c.mourning ? 2.5 : 0.6;
    default:
      return 1;
  }
}

/** Biomes with stone at hand. */
export function stony(biome: number): boolean {
  return biome === Biome.Mountains || biome === Biome.Beach || biome === Biome.Tundra || biome === Biome.Desert;
}

export function foresty(biome: number): boolean {
  return biome === Biome.TemperateForest || biome === Biome.Rainforest || biome === Biome.Taiga;
}

/** Work a person can do for the group. */
export const TASKS = ['gather', 'hunt', 'fish', 'build', 'heal', 'teach', 'tinker', 'fire'] as const;
export type Task = (typeof TASKS)[number];
