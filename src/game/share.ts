/**
 * Sharing a world. A file holds everything (it loads at once). A code holds
 * only the planet, the moment the people appeared and every power you used:
 * since the world runs the same way every time, the code rebuilds the very
 * same history (it is worked out again while loading).
 */
import { decodeWorldCode } from '../core/worldCode';
import type { PowerEvent } from '../sim/powers';
import { sanitizeEvents } from './saveData';

export interface HistoryCode {
  code: string;
  /** When the first people appeared (game minutes). */
  start: number;
  /** The moment the code was made. */
  minutes: number;
  events: PowerEvent[];
}

type Packed = [number, string, number, number, number, number?, number?, number?, number[]?];

function pack(e: PowerEvent): Packed {
  const out: Packed = [e.id, e.kind, e.minutes, e.cell, e.seed];
  if (e.target !== undefined || e.extra !== undefined || e.other !== undefined || e.stamps) out[5] = e.target ?? -1;
  if (e.extra !== undefined || e.other !== undefined || e.stamps) out[6] = e.extra ?? -1;
  if (e.other !== undefined || e.stamps) out[7] = e.other ?? -1;
  if (e.stamps) out[8] = e.stamps;
  return out;
}

function unpack(p: unknown[]): Record<string, unknown> {
  const e: Record<string, unknown> = { id: p[0], kind: p[1], minutes: p[2], cell: p[3], seed: p[4] };
  if (typeof p[5] === 'number' && p[5] >= 0) e.target = p[5];
  if (typeof p[6] === 'number' && p[6] >= 0) e.extra = p[6];
  if (typeof p[7] === 'number' && p[7] >= 0) e.other = p[7];
  if (Array.isArray(p[8])) e.stamps = p[8];
  return e;
}

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const s = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** "ENIS-ABCD-EFGH.z…" (z: compressed, j: plain). */
export async function encodeHistory(h: HistoryCode): Promise<string> {
  const json = JSON.stringify({ v: 1, s: h.start, m: Math.round(h.minutes), e: h.events.map(pack) });
  const raw = new TextEncoder().encode(json);
  if (typeof CompressionStream !== 'undefined') {
    try {
      return `${h.code}.z${toBase64Url(await pipe(raw, new CompressionStream('deflate-raw')))}`;
    } catch {
      /* fall back to plain */
    }
  }
  return `${h.code}.j${toBase64Url(raw)}`;
}

/** A history code, or null if it is not one (or damaged). */
export async function decodeHistory(text: string, cellCount = Infinity): Promise<HistoryCode | null> {
  try {
    const trimmed = text.trim();
    const dot = trimmed.indexOf('.');
    if (dot < 0) return null;
    const code = trimmed.slice(0, dot);
    if (!decodeWorldCode(code)) return null;
    const body = trimmed.slice(dot + 1);
    let bytes = fromBase64Url(body.slice(1));
    if (body[0] === 'z') {
      if (typeof DecompressionStream === 'undefined') return null;
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    } else if (body[0] !== 'j') return null;
    const data = JSON.parse(new TextDecoder().decode(bytes)) as { v?: number; s?: unknown; m?: unknown; e?: unknown };
    if (data.v !== 1 || typeof data.s !== 'number' || typeof data.m !== 'number' || !Array.isArray(data.e)) return null;
    const events = sanitizeEvents(
      data.e.filter((p): p is unknown[] => Array.isArray(p)).map(unpack),
      cellCount,
    );
    return { code, start: data.s, minutes: Math.max(data.m, data.s), events };
  } catch {
    return null;
  }
}

/** A file name for a saved world, e.g. "eNis-Troton-Jahr-1203.json". */
export function saveFileName(planet: string, year: number): string {
  const safe = planet.replace(/[^\p{L}\p{N}-]+/gu, '') || 'Welt';
  return `eNis-${safe}-${year}.json`;
}
