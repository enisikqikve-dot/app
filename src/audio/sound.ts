/**
 * Sound effects synthesized with the Web Audio API (no audio files needed).
 * Browsers only allow sound after the player has interacted, so the audio
 * context is created on the first click or tap.
 */
import { safeStorage } from '../core/store';

export type SoundName =
  | 'thunder'
  | 'boom'
  | 'whoosh'
  | 'rumble'
  | 'roar'
  | 'wave'
  | 'rain'
  | 'wind'
  | 'crackle'
  | 'chime'
  | 'thud'
  | 'chill'
  | 'heat'
  | 'dry';

const STORAGE_KEY = 'enis.sound';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastPlayed = new Map<SoundName, number>();
  enabled: boolean;

  constructor() {
    this.enabled = safeStorage.get(STORAGE_KEY) !== 'off';
    const unlock = () => {
      this.ensure();
      if (this.ctx?.state === 'suspended') void this.ctx.resume();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    safeStorage.set(STORAGE_KEY, on ? 'on' : 'off');
    if (this.master) this.master.gain.value = on ? 0.7 : 0;
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.7 : 0;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  /** volume 0 … 1 (e.g. quieter when the camera is far away). */
  play(name: SoundName, volume = 1): void {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noise || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // Rapid repeats (brush strokes) would get noisy.
    const last = this.lastPlayed.get(name) ?? -1;
    if (now - last < 0.12) return;
    this.lastPlayed.set(name, now);
    const out = ctx.createGain();
    out.gain.value = Math.max(0.05, Math.min(1, volume));
    out.connect(this.master);
    try {
      RECIPES[name](ctx, out, this.noise, now);
    } catch {
      /* ignore audio errors */
    }
  }
}

type Recipe = (ctx: AudioContext, out: AudioNode, noise: AudioBuffer, t: number) => void;

function noiseSource(ctx: AudioContext, noise: AudioBuffer, t: number, duration: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  src.start(t, Math.random() * 1.5);
  src.stop(t + duration);
  return src;
}

function envelope(ctx: AudioContext, t: number, attack: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

function filtered(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function tone(ctx: AudioContext, out: AudioNode, t: number, freq: number, endFreq: number, attack: number, peak: number, decay: number, type: OscillatorType = 'sine'): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(endFreq, t + attack + decay);
  const g = envelope(ctx, t, attack, peak, decay);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

const RECIPES: Record<SoundName, Recipe> = {
  thunder(ctx, out, noise, t) {
    const crack = noiseSource(ctx, noise, t, 0.6);
    crack.connect(filtered(ctx, 'highpass', 900)).connect(envelope(ctx, t, 0.005, 0.9, 0.4)).connect(out);
    const roll = noiseSource(ctx, noise, t + 0.05, 3.5);
    const lp = filtered(ctx, 'lowpass', 260);
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + 3);
    roll.connect(lp).connect(envelope(ctx, t + 0.05, 0.08, 1.2, 3.2)).connect(out);
  },
  boom(ctx, out, noise, t) {
    tone(ctx, out, t, 90, 28, 0.02, 1.2, 2.2);
    const n = noiseSource(ctx, noise, t, 4);
    const lp = filtered(ctx, 'lowpass', 900);
    lp.frequency.exponentialRampToValueAtTime(90, t + 3.5);
    n.connect(lp).connect(envelope(ctx, t, 0.01, 1.4, 3.8)).connect(out);
  },
  whoosh(ctx, out, noise, t) {
    const n = noiseSource(ctx, noise, t, 2.5);
    const bp = filtered(ctx, 'bandpass', 2400, 1.4);
    bp.frequency.exponentialRampToValueAtTime(260, t + 2.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.8, t + 2.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.45);
    n.connect(bp).connect(g).connect(out);
  },
  rumble(ctx, out, noise, t) {
    const n = noiseSource(ctx, noise, t, 4.2);
    const lp = filtered(ctx, 'lowpass', 110);
    const trem = ctx.createGain();
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 7;
    depth.gain.value = 0.4;
    lfo.connect(depth).connect(trem.gain);
    lfo.start(t);
    lfo.stop(t + 4.2);
    n.connect(lp).connect(trem).connect(envelope(ctx, t, 0.4, 1.6, 3.6)).connect(out);
    tone(ctx, out, t, 42, 30, 0.3, 0.7, 3.5);
  },
  roar(ctx, out, noise, t) {
    const n = noiseSource(ctx, noise, t, 5);
    const bp = filtered(ctx, 'bandpass', 220, 0.8);
    n.connect(bp).connect(envelope(ctx, t, 0.6, 1.3, 4.2)).connect(out);
    tone(ctx, out, t, 70, 35, 0.1, 1.0, 3.0);
  },
  wave(ctx, out, noise, t) {
    const n = noiseSource(ctx, noise, t, 4);
    const lp = filtered(ctx, 'lowpass', 300);
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(1600, t + 1.4);
    lp.frequency.exponentialRampToValueAtTime(250, t + 3.8);
    n.connect(lp).connect(envelope(ctx, t, 1.2, 1.1, 2.6)).connect(out);
  },
  rain(ctx, out, noise, t) {
    const n = noiseSource(ctx, noise, t, 4);
    n.connect(filtered(ctx, 'highpass', 1400)).connect(envelope(ctx, t, 0.8, 0.45, 3)).connect(out);
  },
  wind(ctx, out, noise, t) {
    const n = noiseSource(ctx, noise, t, 5);
    const bp = filtered(ctx, 'bandpass', 500, 1.2);
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 0.35;
    depth.gain.value = 300;
    lfo.connect(depth).connect(bp.frequency);
    lfo.start(t);
    lfo.stop(t + 5);
    n.connect(bp).connect(envelope(ctx, t, 1, 1.1, 3.8)).connect(out);
  },
  crackle(ctx, out, noise, t) {
    for (let i = 0; i < 26; i++) {
      const at = t + Math.random() * 2.2;
      const n = noiseSource(ctx, noise, at, 0.03);
      n.connect(filtered(ctx, 'bandpass', 1500 + Math.random() * 2500, 2)).connect(envelope(ctx, at, 0.002, 0.4 + Math.random() * 0.5, 0.025)).connect(out);
    }
    const bed = noiseSource(ctx, noise, t, 2.6);
    bed.connect(filtered(ctx, 'lowpass', 500)).connect(envelope(ctx, t, 0.3, 0.35, 2.2)).connect(out);
  },
  chime(ctx, out, _noise, t) {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ctx, out, t + i * 0.09, f, f, 0.01, 0.25, 1.6, 'triangle'));
  },
  thud(ctx, out, noise, t) {
    tone(ctx, out, t, 75, 40, 0.01, 0.8, 0.35);
    noiseSource(ctx, noise, t, 0.4).connect(filtered(ctx, 'lowpass', 400)).connect(envelope(ctx, t, 0.01, 0.5, 0.3)).connect(out);
  },
  chill(ctx, out, _noise, t) {
    [220, 277.18, 329.63, 440].forEach((f) => tone(ctx, out, t, f, f * 0.98, 1.2, 0.18, 3.5, 'sine'));
  },
  heat(ctx, out, _noise, t) {
    [196, 246.94, 293.66, 392].forEach((f) => tone(ctx, out, t, f, f * 1.03, 1, 0.2, 3.2, 'triangle'));
  },
  dry(ctx, out, noise, t) {
    noiseSource(ctx, noise, t, 3.5).connect(filtered(ctx, 'bandpass', 900, 0.9)).connect(envelope(ctx, t, 0.8, 0.5, 2.5)).connect(out);
  },
};
