/** The divine powers: what they are called internally and how they are aimed. */

export type PowerKind =
  | 'lightning'
  | 'rain'
  | 'drought'
  | 'fire'
  | 'storm'
  | 'quake'
  | 'volcano'
  | 'tsunami'
  | 'meteor'
  | 'iceAge'
  | 'heatAge'
  | 'raise'
  | 'lower'
  | 'forest'
  | 'harvest'
  | 'heal'
  | 'revive'
  | 'createPeople'
  | 'spawnAnimals'
  | 'smite'
  | 'plague'
  | 'move'
  | 'clone'
  | 'luck'
  | 'fertility'
  | 'sign'
  | 'wLove'
  | 'wCourage'
  | 'wFear'
  | 'wAnger'
  | 'wForgive'
  | 'wComfort'
  | 'wEmigrate'
  | 'wPeace'
  | 'wLead'
  | 'wIdea'
  | 'wTeach'
  | 'timeSkip';

/**
 * point: tap a place · brush: drag over the land · global: the whole planet at once ·
 * person: tap a living person · dead: tap someone who died recently · carry: tap a person, then a place ·
 * pair: tap a person, then another person.
 */
export type PowerTarget = 'point' | 'brush' | 'global' | 'person' | 'dead' | 'carry' | 'pair';

export type PowerCategory = 'nature' | 'blessing' | 'whisper' | 'life';

export interface PowerDef {
  kind: PowerKind;
  target: PowerTarget;
  /** Big disasters: the game slows down to 1× so you can watch. */
  catastrophe: boolean;
  /** Size of the aiming ring, in km. */
  aimKm: number;
  category?: PowerCategory;
}

export const NATURE_POWERS: readonly PowerDef[] = [
  { kind: 'lightning', target: 'point', catastrophe: false, aimKm: 40 },
  { kind: 'rain', target: 'point', catastrophe: false, aimKm: 380 },
  { kind: 'drought', target: 'point', catastrophe: false, aimKm: 620 },
  { kind: 'fire', target: 'point', catastrophe: true, aimKm: 60 },
  { kind: 'storm', target: 'point', catastrophe: true, aimKm: 230 },
  { kind: 'quake', target: 'point', catastrophe: true, aimKm: 360 },
  { kind: 'volcano', target: 'point', catastrophe: true, aimKm: 210 },
  { kind: 'tsunami', target: 'point', catastrophe: true, aimKm: 420 },
  { kind: 'meteor', target: 'point', catastrophe: true, aimKm: 300 },
  { kind: 'iceAge', target: 'global', catastrophe: false, aimKm: 0 },
  { kind: 'heatAge', target: 'global', catastrophe: false, aimKm: 0 },
  { kind: 'raise', target: 'brush', catastrophe: false, aimKm: 125 },
  { kind: 'lower', target: 'brush', catastrophe: false, aimKm: 125 },
  { kind: 'forest', target: 'brush', catastrophe: false, aimKm: 125 },
];

export const BLESSING_POWERS: readonly PowerDef[] = [
  { kind: 'harvest', target: 'point', catastrophe: false, aimKm: 400, category: 'blessing' },
  { kind: 'heal', target: 'point', catastrophe: false, aimKm: 170, category: 'blessing' },
  { kind: 'revive', target: 'dead', catastrophe: false, aimKm: 0, category: 'blessing' },
  { kind: 'luck', target: 'person', catastrophe: false, aimKm: 0, category: 'blessing' },
  { kind: 'fertility', target: 'person', catastrophe: false, aimKm: 0, category: 'blessing' },
  { kind: 'sign', target: 'point', catastrophe: false, aimKm: 500, category: 'blessing' },
];

/** Whispered thoughts: invisible, they feel like the person's own. */
export const WHISPER_POWERS: readonly PowerDef[] = [
  { kind: 'wLove', target: 'pair', catastrophe: false, aimKm: 0, category: 'whisper' },
  { kind: 'wCourage', target: 'person', catastrophe: false, aimKm: 0, category: 'whisper' },
  { kind: 'wFear', target: 'person', catastrophe: false, aimKm: 0, category: 'whisper' },
  { kind: 'wAnger', target: 'person', catastrophe: false, aimKm: 0, category: 'whisper' },
  { kind: 'wForgive', target: 'person', catastrophe: false, aimKm: 0, category: 'whisper' },
  { kind: 'wComfort', target: 'person', catastrophe: false, aimKm: 0, category: 'whisper' },
  { kind: 'wEmigrate', target: 'person', catastrophe: false, aimKm: 0, category: 'whisper' },
  { kind: 'wPeace', target: 'person', catastrophe: false, aimKm: 0, category: 'whisper' },
  { kind: 'wLead', target: 'person', catastrophe: false, aimKm: 0, category: 'whisper' },
  { kind: 'wIdea', target: 'person', catastrophe: false, aimKm: 0, category: 'whisper' },
  { kind: 'wTeach', target: 'person', catastrophe: false, aimKm: 0, category: 'whisper' },
];

/** Not a power of the palette: skipping time is kept in the history so replays match. */
export const TIME_SKIP: PowerDef = { kind: 'timeSkip', target: 'global', catastrophe: false, aimKm: 0 };

export const LIFE_POWERS: readonly PowerDef[] = [
  { kind: 'createPeople', target: 'point', catastrophe: false, aimKm: 30, category: 'life' },
  { kind: 'spawnAnimals', target: 'point', catastrophe: false, aimKm: 60, category: 'life' },
  { kind: 'smite', target: 'person', catastrophe: false, aimKm: 0, category: 'life' },
  { kind: 'plague', target: 'point', catastrophe: false, aimKm: 450, category: 'life' },
  { kind: 'move', target: 'carry', catastrophe: false, aimKm: 0, category: 'life' },
  { kind: 'clone', target: 'person', catastrophe: false, aimKm: 0, category: 'life' },
];

export const ALL_POWERS: readonly PowerDef[] = [
  ...NATURE_POWERS.map((p) => ({ ...p, category: 'nature' as const })),
  ...BLESSING_POWERS,
  ...WHISPER_POWERS,
  ...LIFE_POWERS,
  TIME_SKIP,
];

export function powerDef(kind: PowerKind): PowerDef {
  return ALL_POWERS.find((p) => p.kind === kind)!;
}

/** Choices some powers offer (how many people, which animal). */
export const POWER_OPTIONS: Partial<Record<PowerKind, number[]>> = {
  createPeople: [1, 2, 5],
  spawnAnimals: [0, 1, 2, 3, 4],
  sign: [0, 1, 2],
};

/** One use of a power. The world is the start planet plus all events, in order. */
export interface PowerEvent {
  id: number;
  kind: PowerKind;
  /** Game time at which the power takes effect. */
  minutes: number;
  /** Target cell (−1 for global powers). */
  cell: number;
  /** Seed for everything random about this event, so replays are identical. */
  seed: number;
  /** Brush powers: the cells of every stamp along the stroke. */
  stamps?: number[];
  /** The person a power is aimed at (heal, revive, smite, move). */
  target?: number;
  /** A chosen option: number of people, the animal species index, the kind of sky sign, minutes skipped. */
  extra?: number;
  /** A second person (whispered love: whom to love). */
  other?: number;
}
