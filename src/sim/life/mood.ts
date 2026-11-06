/**
 * Mood: 50 plus many small reasons, e.g. "+10 well fed" or "−30 mother died".
 * Some reasons come from the body (hunger, cold, sickness), others are
 * remembered for a while (grief, a new partner, a sky sign).
 */
import type { MoodKey, Person } from './types';

export type MoodReasonKey = MoodKey | 'hungry' | 'thirsty' | 'tired' | 'cold' | 'ill' | 'lonely' | 'fed' | 'together' | 'children';

export interface MoodReason {
  key: MoodReasonKey;
  v: number;
  other?: number;
}

/** Bit flag set while someone is freezing (shared with the simulation). */
export const FLAG_FREEZING = 4;

export interface MoodContext {
  partnerAlive: boolean;
  childrenAlive: number;
  /** The group sings and tells stories. */
  song?: boolean;
  /** Sleeps in a hut. */
  hut?: boolean;
  /** Believes firmly. */
  believer?: boolean;
  /** Rich or poor compared with the neighbours. */
  standing?: 'rich' | 'poor' | null;
}

export function moodReasons(p: Person, t: number, ctx: MoodContext): MoodReason[] {
  const out: MoodReason[] = [];
  if (p.hunger > 0.6) out.push({ key: 'hungry', v: p.hunger > 0.9 ? -25 : -12 });
  if (p.thirst > 0.6) out.push({ key: 'thirsty', v: p.thirst > 0.9 ? -25 : -12 });
  if (p.hunger < 0.3 && p.thirst < 0.3) out.push({ key: 'fed', v: 8 });
  if (p.energy < 0.2) out.push({ key: 'tired', v: -8 });
  if (p.flags & FLAG_FREEZING) out.push({ key: 'cold', v: -15 });
  if (p.sick > 0) out.push({ key: 'ill', v: -15 });
  if (p.social > 0.7) out.push({ key: 'lonely', v: p.social > 0.9 ? -20 : -10 });
  if (ctx.partnerAlive) out.push({ key: 'together', v: 10 });
  if (ctx.childrenAlive > 0) out.push({ key: 'children', v: Math.min(15, 5 * ctx.childrenAlive) });
  if (ctx.song) out.push({ key: 'song', v: 5 });
  if (ctx.hut) out.push({ key: 'hut', v: 5 });
  if (ctx.believer) out.push({ key: 'faith', v: 5 });
  if (ctx.standing === 'rich') out.push({ key: 'rich', v: 6 });
  if (ctx.standing === 'poor') out.push({ key: 'poor', v: -8 });
  // Remembered reasons; several of the same kind count with less weight.
  const seen = new Map<MoodKey, number>();
  const sorted = p.moods.filter((m) => m.until > t).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  for (const m of sorted) {
    const k = seen.get(m.key) ?? 0;
    seen.set(m.key, k + 1);
    const v = Math.round(m.v / (1 + k));
    if (v !== 0) out.push({ key: m.key, v, other: m.other });
  }
  return out;
}

export function moodValue(reasons: readonly MoodReason[]): number {
  let sum = 50;
  for (const r of reasons) sum += r.v;
  return Math.max(0, Math.min(100, sum));
}
