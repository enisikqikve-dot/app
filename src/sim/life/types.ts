/**
 * Data of the living world: people, animal herds, food, groups and history.
 * All plain JSON, so it can be saved and snapshotted.
 */

export type Sex = 'f' | 'm';

export type ActionKind = 'idle' | 'walk' | 'gather' | 'drink' | 'sleep' | 'rest' | 'carried';

/** Why a person is walking somewhere. */
export type Goal = 'water' | 'food' | 'group' | 'family' | 'wander' | 'safety' | 'none';

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
  | 'quake'
  | 'age'
  | 'childbirth'
  | 'fight';

/** Character traits, each 0 … 100 (stored in this order in `Person.traits`). */
export const TRAITS = ['curious', 'diligent', 'brave', 'kind', 'aggressive', 'clever', 'pious', 'ambitious'] as const;
export type TraitId = (typeof TRAITS)[number];
export const T_CURIOUS = 0;
export const T_DILIGENT = 1;
export const T_BRAVE = 2;
export const T_KIND = 3;
export const T_AGGRESSIVE = 4;
export const T_CLEVER = 5;
export const T_PIOUS = 6;
export const T_AMBITIOUS = 7;

export type LogKey =
  | 'created'
  | 'born'
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
  | 'died'
  | 'partner'
  | 'separated'
  | 'childBorn'
  | 'twins'
  | 'grief'
  | 'leader'
  | 'emigrated'
  | 'resisted'
  | 'lucky'
  | 'blessedChild'
  | 'sawSign'
  | 'fight'
  | 'madePeace'
  | 'inLove'
  | 'brave'
  | 'afraid'
  | 'angry'
  | 'forgave'
  | 'comforted';

export interface LogEntry {
  t: number;
  key: LogKey;
  cause?: DeathCause;
  /** Another person the entry is about (partner, child, the dead …). */
  other?: number;
  /** A number (how many went along, which sky sign …). */
  n?: number;
}

/** Things that lift or weigh on someone's mood for a while. */
export type MoodKey =
  | 'grief'
  | 'newborn'
  | 'partner'
  | 'separated'
  | 'quarrel'
  | 'sign'
  | 'miracle'
  | 'comfort'
  | 'courage'
  | 'fear'
  | 'anger'
  | 'forgive'
  | 'peace'
  | 'luck'
  | 'fled';

export interface Moodlet {
  key: MoodKey;
  /** Points added to the mood (−50 … +50). */
  v: number;
  until: number;
  other?: number;
}

/** What two people are doing together right now (shown as a bubble). */
export type ChatKind = 'talk' | 'flirt' | 'love' | 'quarrel' | 'play' | 'comfort';

export interface Chat {
  kind: ChatKind;
  with: number;
  until: number;
}

/** A strong feeling, usually whispered by you. */
export type FeelingKind = 'courage' | 'fear' | 'anger';

export interface Feeling {
  kind: FeelingKind;
  until: number;
}

/** Appearance (minimal figures: colors and size only). */
export interface Look {
  /** 0 (light) … 1 (dark). */
  skin: number;
  /** Index into HAIR_COLORS: the color the genes show. */
  hair: number;
  /** Body height factor, about 0.9 … 1.1. */
  height: number;
  /** Index into CLOTH_COLORS. */
  clothes: number;
  /** Two hair alleles (one from each parent); the lower number wins. */
  genes: [number, number];
}

export interface Person {
  id: number;
  name: string;
  sex: Sex;
  /** Game minute of birth. */
  born: number;
  look: Look;
  /** Curiosity, diligence, courage, kindness, aggression, cleverness, piety, ambition (0 … 100). */
  traits: number[];
  /** Parents (−1 if unknown, e.g. made by you). */
  mother: number;
  father: number;
  /** Current partner or −1. */
  partner: number;
  /** Everyone this person was ever a couple with. */
  partners: number[];
  /** The group this person lives with. */
  band: number;
  /** Opinions of others: [person id, −100 … +100]. */
  rels: [number, number][];
  moods: Moodlet[];
  /** Loneliness, 0 (fine) … 1 (very lonely). */
  social: number;
  pregnant?: { father: number; due: number };
  lastBirth?: number;
  /** Blessed with luck until then. */
  luck?: number;
  feel?: Feeling;
  /** Marvelling at a sky sign until then. */
  awe?: number;
  chat?: Chat;
  /** Wants to lead (a whispered intention) until then. */
  lead?: number;
  /** A faraway place this person leads the group to. */
  dest?: number;

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

/** Someone who died a while ago: kept for the family tree and the chronicle. Never changes. */
export interface ArchivedPerson {
  id: number;
  name: string;
  sex: Sex;
  born: number;
  died: number;
  cause: DeathCause;
  mother: number;
  father: number;
  partners: number[];
  look: Look;
  traits: number[];
  band: number;
  cell: number;
  spot: [number, number];
  log: LogEntry[];
}

/** A group of people who live and move together. */
export interface Band {
  id: number;
  leader: number;
  founded: number;
}

export type ChronicleKey =
  | 'founders'
  | 'newcomers'
  | 'birth'
  | 'twins'
  | 'couple'
  | 'separated'
  | 'death'
  | 'leader'
  | 'emigrate'
  | 'moved'
  | 'power'
  | 'sign'
  | 'population'
  | 'extinct';

/** One line in the world chronicle. */
export interface ChronicleEntry {
  t: number;
  key: ChronicleKey;
  /** People the line is about. */
  a?: number;
  b?: number;
  c?: number;
  n?: number;
  /** A power kind or a cause of death. */
  s?: string;
  /** Important lines are highlighted. */
  major?: 1;
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
  /** 4 since milestone 4 (older data is upgraded when loaded). */
  version: number;
  /** Simulation time (game minutes, a multiple of the tick). */
  t: number;
  /** State of the random generator. */
  rng: number;
  nextId: number;
  people: Person[];
  herds: Herd[];
  /** [cell, level, at] for cells where food was eaten. */
  food: [number, number, number][];
  bands: Band[];
  /** Append-only: people who died a while ago. */
  archive: ArchivedPerson[];
  /** Append-only: the world chronicle. */
  chronicle: ChronicleEntry[];
  /**
   * Snapshots leave the two append-only lists out (they only grow, so the
   * current lists hold them) and store how long they were.
   */
  archiveCount?: number;
  chronicleCount?: number;
  /** Highest population milestone written to the chronicle. */
  popRecord: number;
  /** Children born on the planet so far. */
  births?: number;
}

/** Hair colors; the first six are genes (lower = dominant), the last is grey hair of old age. */
export const HAIR_COLORS = [0x1c1612, 0x3b2618, 0x6b4425, 0x8c4a2a, 0xc9a26b, 0xa8401f, 0x9a9a96];
export const HAIR_GREY = 6;
export const CLOTH_COLORS = [0x7a5a3a, 0x8b6b45, 0x6d4f33, 0x9a7b52, 0x5e4630];
