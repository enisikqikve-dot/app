/**
 * Checks data from outside the game (browser storage, the viewer's live-update
 * hook, old versions) before it is used. Anything unexpected is dropped
 * instead of crashing the start.
 */
import { decodeWorldCode } from '../core/worldCode';
import { ALL_POWERS, type PowerEvent } from '../sim/powers';
import type { SpeedIndex } from '../sim/clock';
import type { LifeData } from '../sim/life/types';

/** The living world at a moment, for rewinding: `eventCount` powers had been used by then. */
export interface LifeSnapshot {
  t: number;
  eventCount: number;
  data: LifeData;
  periodic: boolean;
}

export interface SaveData {
  code: string;
  minutes: number;
  speedIndex: SpeedIndex;
  events?: PowerEvent[];
  /** The living world (milestone 3+). Older saves have none. */
  life?: LifeData;
  snaps?: LifeSnapshot[];
}

/** A light check that the data has the shape of a living world. */
export function isLifeData(x: unknown): x is LifeData {
  if (!x || typeof x !== 'object') return false;
  const d = x as Record<string, unknown>;
  return (
    isFiniteNumber(d.t) &&
    isFiniteNumber(d.rng) &&
    isFiniteNumber(d.nextId) &&
    Array.isArray(d.people) &&
    Array.isArray(d.herds) &&
    Array.isArray(d.food) &&
    d.people.every((p) => !!p && typeof p === 'object' && isFiniteNumber((p as Record<string, unknown>).cell) && Array.isArray((p as Record<string, unknown>).log)) &&
    d.herds.every((h) => !!h && typeof h === 'object' && isFiniteNumber((h as Record<string, unknown>).cell) && isFiniteNumber((h as Record<string, unknown>).count))
  );
}

function isSnapshot(x: unknown): x is LifeSnapshot {
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  return isFiniteNumber(s.t) && isFiniteNumber(s.eventCount) && typeof s.periodic === 'boolean' && isLifeData(s.data);
}

const KINDS = new Set<string>(ALL_POWERS.map((p) => p.kind));

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

/** Keeps only well-formed events, in time order. */
export function sanitizeEvents(raw: unknown, cellCount = Infinity): PowerEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: PowerEvent[] = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const x = e as Record<string, unknown>;
    if (typeof x.kind !== 'string' || !KINDS.has(x.kind)) continue;
    if (!isFiniteNumber(x.id) || !isFiniteNumber(x.minutes) || !isFiniteNumber(x.cell) || !isFiniteNumber(x.seed)) continue;
    if (x.cell >= cellCount || x.cell < -1) continue;
    const event: PowerEvent = { id: x.id, kind: x.kind as PowerEvent['kind'], minutes: x.minutes, cell: Math.floor(x.cell), seed: x.seed >>> 0 };
    if (isFiniteNumber(x.target)) event.target = x.target;
    if (isFiniteNumber(x.extra)) event.extra = x.extra;
    if (isFiniteNumber(x.other)) event.other = x.other;
    if (Array.isArray(x.stamps)) {
      event.stamps = x.stamps.filter((c): c is number => isFiniteNumber(c) && c >= 0 && c < cellCount).map((c) => Math.floor(c));
    }
    out.push(event);
  }
  for (let i = 1; i < out.length; i++) if (out[i].minutes < out[i - 1].minutes) return out.slice(0, i);
  return out;
}

/** A valid save or null. Accepts anything, e.g. `{}` or `undefined`. */
export function parseSaveData(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const x = raw as Record<string, unknown>;
  if (typeof x.code !== 'string' || !decodeWorldCode(x.code)) return null;
  if (!isFiniteNumber(x.minutes) || x.minutes < 0) return null;
  const speed = isFiniteNumber(x.speedIndex) && x.speedIndex >= 0 && x.speedIndex <= 4 ? (Math.floor(x.speedIndex) as SpeedIndex) : 1;
  const events = sanitizeEvents(x.events);
  const save: SaveData = { code: x.code, minutes: x.minutes, speedIndex: speed, events };
  if (isLifeData(x.life) && x.life.t <= x.minutes + 1) save.life = x.life;
  if (save.life && Array.isArray(x.snaps)) {
    save.snaps = x.snaps.filter(isSnapshot).filter((s) => s.eventCount <= events.length && s.t <= save.life!.t);
  }
  return save;
}
