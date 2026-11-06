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
  | 'forest';

/** point: tap a place · brush: drag over the land · global: affects the whole planet at once. */
export type PowerTarget = 'point' | 'brush' | 'global';

export interface PowerDef {
  kind: PowerKind;
  target: PowerTarget;
  /** Big disasters: the game slows down to 1× so you can watch. */
  catastrophe: boolean;
  /** Size of the aiming ring, in km. */
  aimKm: number;
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

export function powerDef(kind: PowerKind): PowerDef {
  return NATURE_POWERS.find((p) => p.kind === kind)!;
}

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
}
