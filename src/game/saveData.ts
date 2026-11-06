/**
 * Checks data from outside the game (browser storage, the viewer's live-update
 * hook, old versions) before it is used. Anything unexpected is dropped
 * instead of crashing the start.
 */
import { decodeWorldCode } from '../core/worldCode';
import { NATURE_POWERS, type PowerEvent } from '../sim/powers';
import type { SpeedIndex } from '../sim/clock';

export interface SaveData {
  code: string;
  minutes: number;
  speedIndex: SpeedIndex;
  events?: PowerEvent[];
}

const KINDS = new Set<string>(NATURE_POWERS.map((p) => p.kind));

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
  return { code: x.code, minutes: x.minutes, speedIndex: speed, events: sanitizeEvents(x.events) };
}
