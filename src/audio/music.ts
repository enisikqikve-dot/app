/**
 * Music for every age, made on the fly with the Web Audio API: a flute and a
 * skin drum by the fire in the Stone Age, a lyre over a drone in antiquity,
 * modal tunes in the Middle Ages, a piano in the industrial age, warm synth
 * chords in the modern age and glassy bells in the far future. A small
 * melody wanders through the scale of the age; nothing repeats exactly.
 */
import { safeStorage } from '../core/store';

const STORAGE_KEY = 'enis.music';

/** The ages the music knows (the game's epochs map onto these). */
export type MusicAge = 'stone' | 'ancient' | 'classic' | 'medieval' | 'industrial' | 'modern' | 'digital' | 'future';

interface Style {
  /** Beats per minute. */
  bpm: number;
  /** Root note (Hz) and the scale in semitones. */
  root: number;
  scale: number[];
  /** Lead voice. */
  lead: { wave: OscillatorType; attack: number; decay: number; gain: number; vibrato?: number };
  /** A long held drone or chord pad under the tune. */
  pad?: { wave: OscillatorType; gain: number; cutoff: number; chord: number[] };
  /** Bass note on the first beat of the bar. */
  bass?: { wave: OscillatorType; gain: number };
  /** Drum pattern over 8 eighths: k = low drum, t = high tap, . = rest. */
  drums?: string;
  /** How often the lead plays on an eighth (0 … 1). */
  density: number;
}

const MINOR_PENTA = [0, 3, 5, 7, 10, 12, 15];
const DORIAN = [0, 2, 3, 5, 7, 9, 10, 12, 14];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10, 12];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10, 12, 14];
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18];

const STYLES: Record<MusicAge, Style> = {
  stone: { bpm: 62, root: 220, scale: MINOR_PENTA, lead: { wave: 'sine', attack: 0.08, decay: 1.1, gain: 0.22, vibrato: 5 }, drums: 'k...t.k.', density: 0.32 },
  ancient: { bpm: 70, root: 196, scale: DORIAN, lead: { wave: 'triangle', attack: 0.005, decay: 0.9, gain: 0.25 }, pad: { wave: 'sawtooth', gain: 0.035, cutoff: 500, chord: [0, 7] }, drums: 'k..t..t.', density: 0.45 },
  classic: { bpm: 76, root: 220, scale: PHRYGIAN, lead: { wave: 'triangle', attack: 0.004, decay: 1.2, gain: 0.25 }, pad: { wave: 'sawtooth', gain: 0.03, cutoff: 420, chord: [0, 7, 12] }, drums: 'k...k.t.', density: 0.5 },
  medieval: { bpm: 84, root: 262, scale: MIXOLYDIAN, lead: { wave: 'square', attack: 0.03, decay: 0.45, gain: 0.08, vibrato: 4 }, pad: { wave: 'sawtooth', gain: 0.03, cutoff: 650, chord: [0, 7] }, drums: 'k.t.k.t.', density: 0.6 },
  industrial: { bpm: 92, root: 262, scale: MAJOR, lead: { wave: 'triangle', attack: 0.003, decay: 0.8, gain: 0.26 }, bass: { wave: 'triangle', gain: 0.22 }, density: 0.55 },
  modern: { bpm: 96, root: 220, scale: MAJOR, lead: { wave: 'sine', attack: 0.01, decay: 0.6, gain: 0.2 }, pad: { wave: 'sawtooth', gain: 0.045, cutoff: 900, chord: [0, 4, 7, 11] }, bass: { wave: 'sine', gain: 0.25 }, drums: 'k.t.k.tt', density: 0.5 },
  digital: { bpm: 112, root: 247, scale: DORIAN, lead: { wave: 'square', attack: 0.004, decay: 0.22, gain: 0.07 }, pad: { wave: 'sawtooth', gain: 0.04, cutoff: 1200, chord: [0, 3, 7, 10] }, bass: { wave: 'square', gain: 0.09 }, drums: 'k.tkk.t.', density: 0.85 },
  future: { bpm: 66, root: 294, scale: LYDIAN, lead: { wave: 'sine', attack: 0.004, decay: 2.2, gain: 0.16 }, pad: { wave: 'triangle', gain: 0.06, cutoff: 2400, chord: [0, 7, 14, 18] }, density: 0.35 },
};

export class Music {
  private gain: GainNode | null = null;
  private timer: number | null = null;
  private nextBeat = 0;
  private step = 0;
  private note = 2;
  private age: MusicAge = 'stone';
  private padStop: (() => void) | null = null;
  enabled: boolean;

  constructor(private readonly audio: () => { ctx: AudioContext; out: AudioNode } | null) {
    this.enabled = safeStorage.get(STORAGE_KEY) !== 'off';
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    safeStorage.set(STORAGE_KEY, on ? 'on' : 'off');
    if (!on) this.stop();
  }

  /** Called every frame: starts, keeps going, changes with the age of the world. */
  update(age: MusicAge): void {
    if (!this.enabled) return;
    const a = this.audio();
    if (!a || a.ctx.state !== 'running') return;
    if (!this.gain) {
      this.gain = a.ctx.createGain();
      this.gain.gain.value = 0.5;
      this.gain.connect(a.out);
    }
    if (age !== this.age || !this.padStop) {
      this.age = age;
      this.startPad(a.ctx);
    }
    if (this.timer === null) {
      this.nextBeat = a.ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.schedule(), 120);
    }
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.padStop?.();
    this.padStop = null;
  }

  private startPad(ctx: AudioContext): void {
    this.padStop?.();
    this.padStop = null;
    const style = STYLES[this.age];
    if (!style.pad || !this.gain) {
      this.padStop = () => undefined;
      return;
    }
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = style.pad.cutoff;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(style.pad.gain, t + 3);
    filter.connect(g).connect(this.gain);
    const oscs = style.pad.chord.map((semi) => {
      const o = ctx.createOscillator();
      o.type = style.pad!.wave;
      o.frequency.value = (style.root / 2) * Math.pow(2, semi / 12);
      o.detune.value = (Math.random() - 0.5) * 12;
      o.connect(filter);
      o.start(t);
      return o;
    });
    this.padStop = () => {
      const now = ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
      for (const o of oscs) o.stop(now + 1.6);
    };
  }

  /** Plans the notes of the next half second. */
  private schedule(): void {
    const a = this.audio();
    if (!a || !this.gain || !this.enabled) return;
    const ctx = a.ctx;
    const style = STYLES[this.age];
    const eighth = 30 / style.bpm;
    while (this.nextBeat < ctx.currentTime + 0.5) {
      const t = this.nextBeat;
      const pos = this.step % 8;
      const drum = style.drums?.[pos];
      if (drum === 'k') this.drum(ctx, t, 70, 0.32, 0.35);
      if (drum === 't') this.drum(ctx, t, 300, 0.12, 0.08);
      if (style.bass && pos === 0) this.voice(ctx, t, (style.root / 4) * Math.pow(2, style.scale[(this.step / 8) % 2 === 0 ? 0 : 3] / 12), style.bass.wave, 0.01, eighth * 7, style.bass.gain);
      if (Math.random() < style.density) {
        // A wandering tune: mostly small steps, now and then a leap.
        const r = Math.random();
        this.note += r < 0.4 ? -1 : r < 0.8 ? 1 : r < 0.9 ? 3 : -3;
        this.note = Math.max(0, Math.min(style.scale.length - 1, this.note));
        const f = style.root * Math.pow(2, style.scale[this.note] / 12);
        const l = style.lead;
        this.voice(ctx, t, f, l.wave, l.attack, l.decay, l.gain, l.vibrato);
      }
      this.step++;
      this.nextBeat += eighth;
    }
  }

  private voice(ctx: AudioContext, t: number, freq: number, wave: OscillatorType, attack: number, decay: number, peak: number, vibrato?: number): void {
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = freq;
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = vibrato;
      depth.gain.value = freq * 0.006;
      lfo.connect(depth).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + attack + decay + 0.1);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(this.gain!);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  private drum(ctx: AudioContext, t: number, freq: number, peak: number, decay: number): void {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.8, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(this.gain!);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
}

/** Which music suits an age of the world. */
export function musicFor(epoch: string): MusicAge {
  switch (epoch) {
    case 'neolithic':
    case 'civilization':
    case 'bronze':
      return 'ancient';
    case 'antiquity':
      return 'classic';
    case 'medieval':
    case 'renaissance':
      return 'medieval';
    case 'industrial':
      return 'industrial';
    case 'modern':
      return 'modern';
    case 'information':
      return 'digital';
    case 'future':
    case 'farFuture':
      return 'future';
    default:
      return 'stone';
  }
}
