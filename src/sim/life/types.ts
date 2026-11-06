/** Data of the living world: people, animal herds and food. All plain JSON, so it can be saved and snapshotted. */

export type Sex = 'f' | 'm';

export type ActionKind = 'idle' | 'walk' | 'gather' | 'drink' | 'sleep' | 'rest' | 'carried';

/** Why a person is walking somewhere. */
export type Goal = 'water' | 'food' | 'group' | 'wander' | 'safety' | 'none';

export type DeathCause =
  | 'hunger'
  | 'thirst'
  | 'cold'
  | 'sickness'
  | 'fire'
  | 'lava'
  | 'flood'
  | 'impact'
  | 'lightning'
  | 'god'
  | 'storm'
  | 'quake';

export type LogKey =
  | 'created'
  | 'starving'
  | 'parched'
  | 'freezing'
  | 'fledFire'
  | 'fledFlood'
  | 'sick'
  | 'recovered'
  | 'healed'
  | 'carried'
  | 'revived'
  | 'died';

export interface LogEntry {
  t: number;
  key: LogKey;
  cause?: DeathCause;
}

/** Appearance (minimal figures: colors and size only). */
export interface Look {
  /** 0 (light) … 1 (dark). */
  skin: number;
  /** Index into HAIR_COLORS. */
  hair: number;
  /** Body height factor, about 0.9 … 1.1. */
  height: number;
  /** Index into CLOTH_COLORS. */
  clothes: number;
}

export interface Person {
  id: number;
  name: string;
  sex: Sex;
  /** Game minute of birth (people made by you start as adults). */
  born: number;
  look: Look;
  /** Cell the person is in (or leaving). */
  cell: number;
  /** Cell the person walks to, or −1. */
  next: number;
  /** 0 … 1 along the way from `cell` to `next`. */
  progress: number;
  /** Cells after `next`. */
  path: number[];
  goal: Goal;
  action: ActionKind;
  actionUntil: number;
  /** Needs, 0 (fine) … 1 (desperate). */
  hunger: number;
  thirst: number;
  /** 1 = rested, 0 = exhausted. */
  energy: number;
  /** 1 = healthy, 0 = dead. */
  health: number;
  /** Minutes of sickness left (0 = healthy). */
  sick: number;
  immune: boolean;
  /** Spot inside the cell, km east/north of the center. */
  spot: [number, number];
  /** While carried by the invisible hand: where from and when. */
  carriedFrom?: number;
  carriedAt?: number;
  alive: boolean;
  died?: number;
  cause?: DeathCause;
  /** What last hurt the person (becomes the cause of death). */
  hurtBy?: DeathCause;
  log: LogEntry[];
  /** Bit flags so warnings are logged once per episode. */
  flags: number;
}

export type SpeciesId = 'deer' | 'bison' | 'mammoth' | 'wolf';

export interface Herd {
  id: number;
  species: SpeciesId;
  count: number;
  cell: number;
  next: number;
  progress: number;
  hunger: number;
  /** Year of the last births (once per spring). */
  bornYear: number;
  /** Prey the pack is chasing (wolves). */
  prey: number;
}

/** Food used up in a cell; it grows back toward the cell's capacity over time. */
export interface FoodEntry {
  level: number;
  at: number;
}

export interface LifeData {
  /** Simulation time (game minutes, a multiple of the tick). */
  t: number;
  /** State of the random generator. */
  rng: number;
  nextId: number;
  people: Person[];
  herds: Herd[];
  /** [cell, level, at] for cells where food was eaten. */
  food: [number, number, number][];
}

export const HAIR_COLORS = [0x1c1612, 0x3b2618, 0x6b4425, 0xa86a3c, 0xc9a26b, 0x8c2f1c, 0x9a9a96];
export const CLOTH_COLORS = [0x7a5a3a, 0x8b6b45, 0x6d4f33, 0x9a7b52, 0x5e4630];
