/**
 * The living world: the generated planet plus everything the player's powers
 * did to it.
 *
 * - Permanent changes (heights, planted forests) are written into the planet.
 * - Lasting-but-fading effects are "scars": a set of cells with a start time
 *   and per-cell delay (fire spreading, lava flowing, a flood wave arriving).
 *   What a scar looks like at any moment is a pure function of its age.
 * - Global climate changes (ice age, volcanic winter) are "shifts".
 *
 * The world is fully determined by the start planet and the list of events,
 * so rewinding means: reset to the start planet and replay the earlier events.
 */
import { Rng } from '../core/rng';
import { nearestCell } from './planet/geodesic';
import {
  computeCoastDistance,
  lapseRate,
  latitudeOf,
  seasonAmplitudeFor,
  type PlanetData,
} from './planet/generate';
import { Biome, classifyBiome, isWater } from './planet/biomes';
import { computeRivers } from './planet/rivers';
import { MINUTES_PER_DAY, MINUTES_PER_YEAR } from './clock';
import type { PowerEvent, PowerKind } from './powers';

const HOUR = 60;
const DAY = MINUTES_PER_DAY;
const YEAR = MINUTES_PER_YEAR;

export type ScarKind = 'burn' | 'lava' | 'flood' | 'storm' | 'drought' | 'rain' | 'ash' | 'impact' | 'quake' | 'eruption' | 'bounty' | 'plague';

export interface Scar {
  id: number;
  eventId: number;
  kind: ScarKind;
  /** Game minute the scar begins. */
  start: number;
  cells: Uint32Array;
  /** Minutes after `start` until the effect reaches each cell. */
  delay: Float32Array;
  /** 0 … 1 per cell. */
  strength: Float32Array;
  /** Absolute minute after which the active phase is cut short (e.g. rain puts out a fire). */
  until: Float32Array;
  index: Map<number, number>;
  /** Minutes the active phase lasts per cell (flames, hot lava, standing water, rain). */
  active: number;
  /** Minutes the color tint fades afterwards. */
  tint: number;
  /** Fraction of trees destroyed (× strength). */
  damage: number;
  /** Minutes until the trees have grown back. */
  recovery: number;
  /** After this minute the scar has no effect left. */
  end: number;
  /** For effects with a visual center (rain cloud, eruption, wave). */
  center: number;
  radiusKm: number;
  /** Storms: cells along the path; waves: speed of the front. */
  path?: number[];
  speedKmPerMin?: number;
}

export interface ClimateShift {
  eventId: number;
  kind: 'iceAge' | 'heatAge' | 'volcanicWinter' | 'impactWinter';
  start: number;
  rampIn: number;
  hold: number;
  rampOut: number;
  /** °C added to every temperature at full strength. */
  delta: number;
  /** 0 … 1, dust in the air that dims the sun. */
  dust: number;
}

/** What is going on at one cell right now. All values 0 … 1 (veg: 1 = untouched). */
export interface CellState {
  glow: number;
  burning: boolean;
  char: number;
  lavaHeat: number;
  water: number;
  wet: number;
  dry: number;
  green: number;
  ash: number;
  raining: boolean;
  veg: number;
  burnt: boolean;
  lavaRock: boolean;
  /** Wind of a passing storm, 0 … 1. */
  storm: number;
  /** A blessed harvest, 0 … 1 (more food). */
  bounty: number;
  /** Inside a plague zone. */
  plague: boolean;
}

/** Per-cell effect channels for rendering, refreshed a few times per second. */
export class Overlay {
  readonly glow: Float32Array;
  readonly char: Float32Array;
  readonly water: Float32Array;
  readonly wet: Float32Array;
  readonly dry: Float32Array;
  readonly green: Float32Array;
  readonly ash: Float32Array;
  readonly veg: Float32Array;
  readonly burning: Uint8Array;
  /** Cells that are not neutral right now. */
  touched: number[] = [];
  /** Cells that changed since the previous refresh (were or are touched). */
  changed: number[] = [];
  private readonly mark: Uint32Array;
  private stamp = 1;

  constructor(cellCount: number) {
    this.glow = new Float32Array(cellCount);
    this.char = new Float32Array(cellCount);
    this.water = new Float32Array(cellCount);
    this.wet = new Float32Array(cellCount);
    this.dry = new Float32Array(cellCount);
    this.green = new Float32Array(cellCount);
    this.ash = new Float32Array(cellCount);
    this.veg = new Float32Array(cellCount).fill(1);
    this.burning = new Uint8Array(cellCount);
    this.mark = new Uint32Array(cellCount);
  }

  clearCell(c: number): void {
    this.glow[c] = this.char[c] = this.water[c] = this.wet[c] = this.dry[c] = this.green[c] = this.ash[c] = 0;
    this.veg[c] = 1;
    this.burning[c] = 0;
  }

  /** Starts a refresh: forgets the old values but remembers which cells to repaint. */
  begin(): void {
    this.stamp++;
    this.changed = this.touched;
    for (const c of this.touched) {
      this.clearCell(c);
      this.mark[c] = 0;
    }
    this.touched = [];
  }

  touch(c: number): void {
    if (this.mark[c] !== this.stamp) {
      this.mark[c] = this.stamp;
      this.touched.push(c);
    }
  }

  finish(): void {
    const seen = new Set(this.changed);
    for (const c of this.touched) if (!seen.has(c)) this.changed.push(c);
  }
}

function smooth(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function envelope(age: number, rampIn: number, hold: number, rampOut: number): number {
  if (age < 0) return 0;
  if (age < rampIn) return smooth(age / rampIn);
  if (age < rampIn + hold) return 1;
  if (age < rampIn + hold + rampOut) return 1 - smooth((age - rampIn - hold) / rampOut);
  return 0;
}

const FLAMMABILITY: Record<number, number> = {
  [Biome.Grassland]: 0.5,
  [Biome.Steppe]: 0.45,
  [Biome.TemperateForest]: 0.66,
  [Biome.Rainforest]: 0.3,
  [Biome.Savanna]: 0.6,
  [Biome.Taiga]: 0.7,
  [Biome.Tundra]: 0.15,
  [Biome.Beach]: 0.05,
  [Biome.Mountains]: 0.08,
};

/** Small binary heap of [time, cell] for fire spreading (ties broken by cell id). */
class MinHeap {
  private readonly items: [number, number][] = [];
  get size(): number {
    return this.items.length;
  }
  push(item: [number, number]): void {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(a[i], a[p])) {
        [a[i], a[p]] = [a[p], a[i]];
        i = p;
      } else break;
    }
  }
  pop(): [number, number] {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
  private less(x: [number, number], y: [number, number]): boolean {
    return x[0] < y[0] || (x[0] === y[0] && x[1] < y[1]);
  }
}

interface BaseCopy {
  heightM: Float32Array;
  temperature: Float32Array;
  moisture: Float32Array;
}

export class World {
  readonly planet: PlanetData;
  readonly kmPerCell: number;
  events: PowerEvent[] = [];
  scars: Scar[] = [];
  shifts: ClimateShift[] = [];
  /** 1 where the player planted a forest. */
  readonly planted: Uint8Array;
  /** Increases whenever heights, biomes or forests change permanently. */
  terrainVersion = 0;
  /** Cells whose height or biome changed since the renderer last asked. */
  readonly changedCells = new Set<number>();

  private readonly base: BaseCopy;
  private readonly baseBiome: Uint8Array;
  private climateDirty = false;
  private nextScarId = 1;

  constructor(planet: PlanetData) {
    this.planet = planet;
    this.base = {
      heightM: planet.heightM.slice(),
      temperature: planet.temperature.slice(),
      moisture: planet.moisture.slice(),
    };
    this.baseBiome = planet.biome.slice();
    this.planted = new Uint8Array(planet.cellCount);
    this.kmPerCell = Math.sqrt((4 * Math.PI * planet.radiusKm * planet.radiusKm) / planet.cellCount);
  }

  // ------------------------------------------------------------ lifecycle

  /** Back to the untouched start planet. */
  reset(): void {
    const p = this.planet;
    p.heightM.set(this.base.heightM);
    p.temperature.set(this.base.temperature);
    p.moisture.set(this.base.moisture);
    p.biome.set(this.baseBiome);
    computeCoastDistance(p, p.heightM, p.coastDistance);
    for (let i = 0; i < p.cellCount; i++) {
      p.seasonAmplitude[i] = seasonAmplitudeFor(latitudeOf(p.positions[i * 3 + 1]), p.heightM[i] >= 0, p.coastDistance[i]);
    }
    computeRivers(p, p.heightM, p.moisture, p);
    this.planted.fill(0);
    this.events = [];
    this.scars = [];
    this.shifts = [];
    this.nextScarId = 1;
    this.climateDirty = false;
    this.terrainVersion++;
    for (let i = 0; i < p.cellCount; i++) this.changedCells.add(i);
  }

  /** Rebuilds the world from scratch with the given events (used for rewinding and loading). */
  rebuild(events: readonly PowerEvent[]): void {
    this.reset();
    for (const e of events) this.apply({ ...e, stamps: e.stamps ? [...e.stamps] : undefined });
  }

  /** Applies one event at its time. Events must come in time order. */
  apply(event: PowerEvent): void {
    this.ensureClimate();
    const rng = new Rng(event.seed);
    switch (event.kind) {
      case 'lightning':
        this.lightning(event, rng);
        break;
      case 'fire':
        this.igniteFire(event, [{ cell: event.cell, time: event.minutes }], rng, 240, true);
        break;
      case 'rain':
        this.rain(event);
        break;
      case 'drought':
        this.drought(event);
        break;
      case 'storm':
        this.storm(event, rng);
        break;
      case 'quake':
        this.quake(event, rng);
        break;
      case 'volcano':
        this.volcano(event, rng);
        break;
      case 'tsunami':
        this.tsunami(event, event.cell, 1);
        break;
      case 'meteor':
        this.meteor(event, rng);
        break;
      case 'iceAge':
        this.shifts.push({ eventId: event.id, kind: 'iceAge', start: event.minutes, rampIn: 40 * YEAR, hold: 350 * YEAR, rampOut: 60 * YEAR, delta: -9, dust: 0 });
        break;
      case 'heatAge':
        this.shifts.push({ eventId: event.id, kind: 'heatAge', start: event.minutes, rampIn: 40 * YEAR, hold: 350 * YEAR, rampOut: 60 * YEAR, delta: 6, dust: 0 });
        break;
      case 'raise':
      case 'lower':
      case 'forest':
        for (const cell of event.stamps ?? [event.cell]) this.brushStamp(event.kind, cell);
        break;
      case 'harvest': {
        const radius = 400;
        const { cells, dist } = this.cellsWithin(event.cell, radius);
        this.addScar(event.id, 'bounty', event.minutes, cells, cells.map(() => 0), dist.map((d) => 1 - (d / radius) * 0.4), {
          active: 14 * DAY,
          tint: 10 * DAY,
          center: event.cell,
          radiusKm: radius,
        });
        this.extinguish(cells, event.minutes, ['drought']);
        break;
      }
      case 'plague': {
        const radius = 450;
        const { cells, dist } = this.cellsWithin(event.cell, radius);
        this.addScar(event.id, 'plague', event.minutes, cells, cells.map(() => 0), dist.map((d) => 1 - d / radius), {
          active: 12 * DAY,
          center: event.cell,
          radiusKm: radius,
        });
        break;
      }
      default:
        // Powers over the living (heal, create people …) leave no mark on the land.
        break;
    }
    this.events.push(event);
    this.ensureClimate();
  }

  /** Brush powers grow while the player drags: one stamp at a time on an event that is already applied. */
  addStamp(event: PowerEvent, cell: number): void {
    event.stamps = event.stamps ?? [];
    event.stamps.push(cell);
    this.brushStamp(event.kind, cell);
    this.ensureClimate();
  }

  // ------------------------------------------------------------ queries

  /** °C added to all temperatures right now (ice age, volcanic winter …). */
  globalTemperature(t: number): number {
    let sum = 0;
    for (const s of this.shifts) sum += s.delta * envelope(t - s.start, s.rampIn, s.hold, s.rampOut);
    return sum;
  }

  /** Dust in the sky right now (0 … 1). */
  dust(t: number): number {
    let sum = 0;
    for (const s of this.shifts) sum += s.dust * envelope(t - s.start, s.rampIn, s.hold, s.rampOut);
    return Math.min(1, sum);
  }

  /** The strongest climate shift right now, if any. */
  climateLabel(t: number): ClimateShift['kind'] | null {
    let best: ClimateShift | null = null;
    let bestValue = 0;
    for (const s of this.shifts) {
      const e = envelope(t - s.start, s.rampIn, s.hold, s.rampOut);
      const value = Math.abs(s.delta) * e + s.dust * e * 10;
      if (e > 0.05 && value > bestValue) {
        bestValue = value;
        best = s;
      }
    }
    return best?.kind ?? null;
  }

  /** Full state of one cell at time t. */
  cellState(cell: number, t: number): CellState {
    const out: CellState = {
      glow: 0,
      burning: false,
      char: 0,
      lavaHeat: 0,
      water: 0,
      wet: 0,
      dry: 0,
      green: 0,
      ash: 0,
      raining: false,
      veg: 1,
      burnt: false,
      lavaRock: false,
      storm: 0,
      bounty: 0,
      plague: false,
    };
    for (const scar of this.scars) {
      const i = scar.index.get(cell);
      if (i !== undefined) this.scarAt(scar, i, t, out);
    }
    return out;
  }

  /** Recomputes the overlay for every cell touched by a scar. */
  computeOverlay(t: number, ov: Overlay): void {
    ov.begin();
    const tmp = this.blankState();
    for (const scar of this.scars) {
      if (t < scar.start || t > scar.end) continue;
      for (let i = 0; i < scar.cells.length; i++) {
        if (t < scar.start + scar.delay[i]) continue;
        const c = scar.cells[i];
        Object.assign(tmp, BLANK);
        this.scarAt(scar, i, t, tmp);
        if (tmp.veg >= 0.999 && tmp.glow + tmp.char + tmp.water + tmp.wet + tmp.dry + tmp.green + tmp.ash < 0.003) continue;
        ov.touch(c);
        if (tmp.glow > ov.glow[c]) ov.glow[c] = tmp.glow;
        if (tmp.char > ov.char[c]) ov.char[c] = tmp.char;
        if (tmp.water > ov.water[c]) ov.water[c] = tmp.water;
        if (tmp.wet > ov.wet[c]) ov.wet[c] = tmp.wet;
        if (tmp.dry > ov.dry[c]) ov.dry[c] = tmp.dry;
        if (tmp.green > ov.green[c]) ov.green[c] = tmp.green;
        if (tmp.ash > ov.ash[c]) ov.ash[c] = tmp.ash;
        ov.veg[c] *= tmp.veg;
        if (tmp.burning) ov.burning[c] = 1;
      }
    }
    ov.finish();
  }

  /** Scars whose visuals (rain clouds, waves, storms, eruptions) should be on screen now. */
  visibleScars(t: number): Scar[] {
    return this.scars.filter((s) => {
      if (t < s.start) return false;
      const age = t - s.start;
      switch (s.kind) {
        case 'rain':
          return age < s.active;
        case 'storm':
          return age < (s.path ? this.stormDuration(s) : 0) + 6 * HOUR;
        case 'flood':
          return s.speedKmPerMin !== undefined && age < s.radiusKm / s.speedKmPerMin + 30;
        case 'eruption':
          return age < s.active;
        default:
          return false;
      }
    });
  }

  stormDuration(s: Scar): number {
    return s.path && s.speedKmPerMin ? ((s.path.length - 1) * 40) / s.speedKmPerMin : 0;
  }

  /** The face biome with planted forests applied. */
  isPlanted(cell: number): boolean {
    return this.planted[cell] === 1;
  }

  kmBetween(a: number, b: number): number {
    const p = this.planet.positions;
    const dot = p[a * 3] * p[b * 3] + p[a * 3 + 1] * p[b * 3 + 1] + p[a * 3 + 2] * p[b * 3 + 2];
    return Math.acos(Math.max(-1, Math.min(1, dot))) * this.planet.radiusKm;
  }

  /** All cells within a radius, with their distance. */
  cellsWithin(center: number, radiusKm: number): { cells: number[]; dist: number[] } {
    const { neighborOffsets, neighbors } = this.planet;
    const cells = [center];
    const dist = [0];
    const seen = new Set([center]);
    for (let q = 0; q < cells.length; q++) {
      const c = cells[q];
      for (let k = neighborOffsets[c]; k < neighborOffsets[c + 1]; k++) {
        const n = neighbors[k];
        if (seen.has(n)) continue;
        seen.add(n);
        const d = this.kmBetween(center, n);
        if (d <= radiusKm) {
          cells.push(n);
          dist.push(d);
        }
      }
    }
    return { cells, dist };
  }

  // ------------------------------------------------------------ scar evaluation

  private blankState(): CellState {
    return { ...BLANK };
  }

  private scarAt(scar: Scar, i: number, t: number, out: CellState): void {
    const arrive = scar.start + scar.delay[i];
    const age = t - arrive;
    if (age < 0) return;
    const s = scar.strength[i];
    const cut = scar.until[i];
    const activeEnd = Math.min(arrive + scar.active, cut);
    const activeNow = t < activeEnd;
    const sinceActive = t - activeEnd;
    const regrow = (x: number) => (scar.recovery > 0 ? smooth(x / scar.recovery) : 1);
    const vegLoss = (factor: number) => {
      out.veg *= 1 - factor * (1 - regrow(Math.max(0, sinceActive)));
    };

    switch (scar.kind) {
      case 'burn': {
        if (cut <= arrive) return; // put out before it got here
        if (activeNow) {
          out.burning = true;
          out.glow = Math.max(out.glow, 0.75 + 0.25 * s);
          out.char = Math.max(out.char, Math.min(1, age / scar.active) * 0.8);
          out.veg *= 1 - Math.min(1, age / (scar.active * 0.5)) * scar.damage * s;
        } else {
          const c = 0.9 * (1 - smooth(sinceActive / scar.tint));
          out.char = Math.max(out.char, c);
          if (c > 0.15) out.burnt = true;
          vegLoss(scar.damage * s);
        }
        return;
      }
      case 'lava': {
        const heat = age < scar.active ? 1 - (age / scar.active) * 0.35 : Math.max(0, 0.65 - (age - scar.active) / (4 * DAY));
        out.lavaHeat = Math.max(out.lavaHeat, heat);
        out.glow = Math.max(out.glow, heat);
        const rock = 1 - 0.55 * smooth((age - scar.active) / scar.tint);
        out.char = Math.max(out.char, rock);
        if (heat < 0.05) out.lavaRock = true;
        out.veg *= 1 - scar.damage * (1 - regrow(Math.max(0, age - scar.active)));
        return;
      }
      case 'flood': {
        if (age < scar.active) out.water = Math.max(out.water, s * (1 - age / scar.active) ** 0.6);
        const wet = age < scar.active ? s : s * (1 - smooth((age - scar.active) / scar.tint));
        out.wet = Math.max(out.wet, wet * 0.85);
        out.veg *= 1 - scar.damage * s * (1 - regrow(Math.max(0, age - scar.active)));
        return;
      }
      case 'storm': {
        const wet = age < scar.active ? 0.6 * s : 0.6 * s * (1 - smooth((age - scar.active) / scar.tint));
        out.wet = Math.max(out.wet, wet);
        if (age < scar.active) {
          out.raining = true;
          out.storm = Math.max(out.storm, s);
        }
        out.veg *= 1 - scar.damage * s * (1 - regrow(Math.max(0, age - scar.active)));
        return;
      }
      case 'drought': {
        if (t >= cut) return;
        const e = envelope(age, 1.5 * DAY, scar.active, 4 * DAY);
        out.dry = Math.max(out.dry, s * e);
        return;
      }
      case 'rain': {
        if (age < scar.active) out.raining = true;
        out.green = Math.max(out.green, s * (1 - smooth((age - scar.active) / scar.tint)) * Math.min(1, age / (0.5 * DAY)));
        out.wet = Math.max(out.wet, age < scar.active ? 0.35 * s : 0.35 * s * (1 - smooth((age - scar.active) / (3 * DAY))));
        return;
      }
      case 'ash': {
        const a = s * Math.min(1, age / (0.5 * DAY)) * (1 - smooth((age - scar.active) / scar.tint));
        out.ash = Math.max(out.ash, a);
        out.veg *= 1 - scar.damage * s * (1 - regrow(Math.max(0, age - scar.active)));
        return;
      }
      case 'impact': {
        if (age < scar.active) out.glow = Math.max(out.glow, s * (1 - age / scar.active));
        out.char = Math.max(out.char, s * (1 - smooth((age - scar.active) / scar.tint)));
        out.veg *= 1 - scar.damage * s * (1 - regrow(Math.max(0, age - scar.active)));
        return;
      }
      case 'quake': {
        out.veg *= 1 - scar.damage * s * (1 - regrow(age));
        return;
      }
      case 'eruption':
        return;
      case 'bounty': {
        const b = s * Math.min(1, age / (0.3 * DAY)) * (1 - smooth((age - scar.active) / scar.tint));
        out.bounty = Math.max(out.bounty, b);
        out.green = Math.max(out.green, b * 0.9);
        return;
      }
      case 'plague':
        if (age < scar.active) out.plague = true;
        return;
    }
  }

  // ------------------------------------------------------------ building blocks

  private addScar(
    eventId: number,
    kind: ScarKind,
    start: number,
    cells: number[],
    delay: number[],
    strength: number[],
    params: Partial<Pick<Scar, 'active' | 'tint' | 'damage' | 'recovery' | 'center' | 'radiusKm' | 'path' | 'speedKmPerMin'>>,
  ): Scar {
    const active = params.active ?? 0;
    const tint = params.tint ?? 0;
    const recovery = params.recovery ?? 0;
    let maxDelay = 0;
    for (const d of delay) if (d > maxDelay) maxDelay = d;
    const scar: Scar = {
      id: this.nextScarId++,
      eventId,
      kind,
      start,
      cells: Uint32Array.from(cells),
      delay: Float32Array.from(delay),
      strength: Float32Array.from(strength),
      until: new Float32Array(cells.length).fill(Infinity),
      index: new Map(cells.map((c, i) => [c, i])),
      active,
      tint,
      damage: params.damage ?? 0,
      recovery,
      end: start + maxDelay + active + Math.max(tint, recovery) + DAY,
      center: params.center ?? cells[0] ?? 0,
      radiusKm: params.radiusKm ?? 0,
      path: params.path,
      speedKmPerMin: params.speedKmPerMin,
    };
    this.scars.push(scar);
    return scar;
  }

  /** How easily a cell catches fire right now (0 … 1). */
  private flammability(cell: number, t: number): number {
    const p = this.planet;
    if (p.heightM[cell] < 0) return 0;
    const base = this.planted[cell] ? 0.68 : FLAMMABILITY[p.biome[cell]] ?? 0;
    if (base <= 0) return 0;
    const st = this.cellState(cell, t);
    if (st.burning || st.raining || st.water > 0.05 || st.lavaHeat > 0.05) return 0;
    const dryness = 1 + 0.55 * st.dry - 0.7 * st.green - 0.9 * st.wet;
    // Cold places burn badly; recently burnt land has little left to burn.
    const tempFactor = Math.max(0.2, Math.min(1, (p.temperature[cell] + 8) / 18));
    return Math.max(0, Math.min(0.95, base * dryness * st.veg * tempFactor));
  }

  /** Fire spreads from cell to cell, faster and further in dry, dense vegetation. */
  private igniteFire(event: PowerEvent, origins: { cell: number; time: number }[], rng: Rng, maxCells: number, force: boolean): void {
    const { neighborOffsets, neighbors } = this.planet;
    const heap = new MinHeap();
    const best = new Map<number, number>();
    for (const o of origins) {
      if (!force && this.flammability(o.cell, o.time) < 0.05) continue;
      if (this.planet.heightM[o.cell] < 0) continue;
      heap.push([o.time, o.cell]);
      best.set(o.cell, o.time);
    }
    const cells: number[] = [];
    const times: number[] = [];
    const done = new Set<number>();
    while (heap.size > 0 && cells.length < maxCells) {
      const [time, c] = heap.pop();
      if (done.has(c)) continue;
      done.add(c);
      cells.push(c);
      times.push(time);
      for (let k = neighborOffsets[c]; k < neighborOffsets[c + 1]; k++) {
        const n = neighbors[k];
        if (done.has(n)) continue;
        const f = this.flammability(n, time);
        if (f <= 0.02 || rng.next() > f) continue;
        const minutesToSpread = (this.kmPerCell / (0.18 + 0.45 * f)) * (0.7 + 0.6 * rng.next());
        const arrive = time + minutesToSpread;
        if (arrive < (best.get(n) ?? Infinity)) {
          best.set(n, arrive);
          heap.push([arrive, n]);
        }
      }
    }
    if (cells.length === 0) return;
    const start = Math.min(...times);
    this.addScar(
      event.id,
      'burn',
      start,
      cells,
      times.map((x) => x - start),
      cells.map(() => 1),
      { active: 9 * HOUR, tint: 2 * YEAR, damage: 1, recovery: 35 * YEAR, center: cells[0] },
    );
  }

  /** Cuts the active phase of fires and droughts inside the given cells from time t on. */
  private extinguish(cells: Iterable<number>, t: number, kinds: ScarKind[]): void {
    const set = cells instanceof Set ? cells : new Set(cells);
    for (const scar of this.scars) {
      if (!kinds.includes(scar.kind)) continue;
      for (const c of set) {
        const i = scar.index.get(c);
        if (i === undefined) continue;
        if (scar.kind === 'burn' && t >= scar.start + scar.delay[i] + scar.active) continue;
        scar.until[i] = Math.min(scar.until[i], t);
      }
    }
  }

  private markHeightsChanged(cells: Iterable<number>): void {
    const p = this.planet;
    for (const c of cells) {
      // Temperature follows the new height (6.5 °C per km).
      p.temperature[c] = this.base.temperature[c] + lapseRate(this.base.heightM[c]) - lapseRate(p.heightM[c]);
      // Fresh land rising from the sea gets moderate moisture.
      if (this.base.heightM[c] < 0 && p.heightM[c] >= 0) p.moisture[c] = Math.max(0.45, Math.min(0.75, p.moisture[c]));
      this.changedCells.add(c);
    }
    this.climateDirty = true;
  }

  /** Recomputes coasts, seasons and biomes after the shape of the land changed. */
  ensureClimate(): void {
    if (!this.climateDirty) return;
    this.climateDirty = false;
    const p = this.planet;
    const oldBiome = p.biome.slice();
    computeCoastDistance(p, p.heightM, p.coastDistance);
    for (let i = 0; i < p.cellCount; i++) {
      const land = p.heightM[i] >= 0;
      p.seasonAmplitude[i] = seasonAmplitudeFor(latitudeOf(p.positions[i * 3 + 1]), land, p.coastDistance[i]);
      p.biome[i] = this.classify(i);
      if (p.biome[i] !== oldBiome[i]) this.changedCells.add(i);
    }
    const oldFresh = p.fresh.slice();
    computeRivers(p, p.heightM, p.moisture, p);
    for (let i = 0; i < p.cellCount; i++) if (p.fresh[i] !== oldFresh[i]) this.changedCells.add(i);
    this.terrainVersion++;
  }

  private classify(i: number): Biome {
    const p = this.planet;
    const biome = classifyBiome({
      heightM: p.heightM[i],
      temperature: p.temperature[i],
      moisture: p.moisture[i],
      nearOcean: p.heightM[i] >= 0 && p.coastDistance[i] === 0,
    });
    if (this.planted[i] && !isWater(biome) && biome !== Biome.Ice && biome !== Biome.Mountains) {
      return plantedBiome(p.temperature[i]);
    }
    return biome;
  }

  // ------------------------------------------------------------ the powers

  private lightning(e: PowerEvent, rng: Rng): void {
    const f = this.flammability(e.cell, e.minutes);
    if (f > 0 && rng.next() < Math.min(0.95, f * 1.35)) {
      this.igniteFire(e, [{ cell: e.cell, time: e.minutes }], rng, 160, false);
    }
  }

  private rain(e: PowerEvent): void {
    const radius = 380;
    const { cells, dist } = this.cellsWithin(e.cell, radius);
    this.addScar(e.id, 'rain', e.minutes, cells, cells.map(() => 0), dist.map((d) => 1 - (d / radius) * 0.5), {
      active: 1.2 * DAY,
      tint: 12 * DAY,
      center: e.cell,
      radiusKm: radius,
    });
    this.extinguish(cells, e.minutes, ['burn', 'drought']);
  }

  private drought(e: PowerEvent): void {
    const radius = 620;
    const { cells, dist } = this.cellsWithin(e.cell, radius);
    this.addScar(e.id, 'drought', e.minutes, cells, cells.map(() => 0), dist.map((d) => 1 - (d / radius) ** 2 * 0.7), {
      active: 22 * DAY,
      center: e.cell,
      radiusKm: radius,
    });
  }

  /** Cells near a great-circle track: distance across and position along it. */
  private trackCells(start: number, heading: number, lengthKm: number, widthKm: number): { cells: number[]; along: number[]; across: number[]; path: number[] } {
    const p = this.planet;
    const sx = p.positions[start * 3];
    const sy = p.positions[start * 3 + 1];
    const sz = p.positions[start * 3 + 2];
    // Tangent basis at the start point.
    let ex = -sz;
    let ey = 0;
    let ez = sx;
    let len = Math.hypot(ex, ey, ez);
    if (len < 1e-6) {
      ex = 1;
      ez = 0;
      len = 1;
    }
    ex /= len;
    ez /= len;
    const nx = sy * ez - sz * ey;
    const ny = sz * ex - sx * ez;
    const nz = sx * ey - sy * ex;
    const ux = Math.cos(heading) * nx + Math.sin(heading) * ex;
    const uy = Math.cos(heading) * ny + Math.sin(heading) * ey;
    const uz = Math.cos(heading) * nz + Math.sin(heading) * ez;

    const best = new Map<number, { across: number; along: number }>();
    const path: number[] = [];
    let cell = start;
    const step = 40;
    for (let s = 0; s <= lengthKm; s += step) {
      const th = s / p.radiusKm;
      const x = sx * Math.cos(th) + ux * Math.sin(th);
      const y = sy * Math.cos(th) + uy * Math.sin(th);
      const z = sz * Math.cos(th) + uz * Math.sin(th);
      cell = nearestCell(p, x, y, z, cell);
      path.push(cell);
      const near = this.cellsWithin(cell, widthKm);
      near.cells.forEach((c, i) => {
        const prev = best.get(c);
        if (!prev || near.dist[i] < prev.across) best.set(c, { across: near.dist[i], along: s });
      });
    }
    const cells = [...best.keys()];
    return {
      cells,
      along: cells.map((c) => best.get(c)!.along),
      across: cells.map((c) => best.get(c)!.across),
      path,
    };
  }

  private storm(e: PowerEvent, rng: Rng): void {
    const width = 230;
    const length = 1400;
    const duration = 2.2 * DAY;
    const speed = length / duration;
    const track = this.trackCells(e.cell, rng.range(0, Math.PI * 2), length, width);
    const strength = track.across.map((d) => 1 - d / width);
    this.addScar(e.id, 'storm', e.minutes, track.cells, track.along.map((a) => a / speed), strength, {
      active: 7 * HOUR,
      tint: 4 * DAY,
      damage: 0.6,
      recovery: 15 * YEAR,
      center: e.cell,
      radiusKm: width,
      path: track.path,
      speedKmPerMin: speed,
    });
    // The storm's rain puts out fires along its path.
    for (let i = 0; i < track.cells.length; i++) {
      this.extinguish([track.cells[i]], e.minutes + track.along[i] / speed, ['burn', 'drought']);
    }
  }

  private quake(e: PowerEvent, rng: Rng): void {
    const p = this.planet;
    const heading = rng.range(0, Math.PI * 2);
    const half = 360;
    // A rift: a valley torn along a line through the epicenter.
    const a = this.trackCells(e.cell, heading, half, 75);
    const b = this.trackCells(e.cell, heading + Math.PI, half, 75);
    const depth = 650 + rng.range(0, 450);
    const rift = new Map<number, number>();
    for (const t of [a, b]) {
      t.cells.forEach((c, i) => {
        const f = (1 - t.across[i] / 75) * (1 - (t.along[i] / half) ** 2);
        rift.set(c, Math.max(rift.get(c) ?? 0, f));
      });
    }
    for (const [c, f] of rift) p.heightM[c] -= depth * f;
    this.markHeightsChanged(rift.keys());
    // Shaking knocks down trees around the epicenter.
    const radius = 650;
    const shake = this.cellsWithin(e.cell, radius);
    this.addScar(e.id, 'quake', e.minutes, shake.cells, shake.cells.map(() => 0), shake.dist.map((d) => 1 - d / radius), {
      damage: 0.25,
      recovery: 8 * YEAR,
      center: e.cell,
      radiusKm: radius,
    });
    // A quake under the sea sends out a wave.
    if (this.base.heightM[e.cell] < -200) this.tsunami(e, e.cell, 0.7);
  }

  private volcano(e: PowerEvent, rng: Rng): void {
    const p = this.planet;
    const radius = 210;
    const summit = e.cell;
    let peak = 2400 + rng.range(0, 1500);
    if (p.heightM[summit] + peak < 900) peak = 900 - p.heightM[summit]; // always break the surface
    const cone = this.cellsWithin(summit, radius);
    cone.cells.forEach((c, i) => {
      p.heightM[c] += peak * Math.pow(1 - cone.dist[i] / radius, 1.6);
    });
    p.heightM[summit] -= peak * 0.12; // crater
    this.markHeightsChanged(cone.cells);
    this.ensureClimate();

    // Eruption: visible plume for a day and a half.
    this.addScar(e.id, 'eruption', e.minutes, [summit], [0], [1], { active: 1.5 * DAY, center: summit, radiusKm: radius });

    // Lava flows run downhill until they reach the sea or a hollow.
    const { neighborOffsets, neighbors } = p;
    const lava = new Map<number, number>([[summit, 0]]);
    const flows = rng.int(3, 5);
    for (let f = 0; f < flows; f++) {
      let c = summit;
      let time = rng.range(0, 3 * HOUR);
      for (let step = 0; step < 22; step++) {
        if (!lava.has(c) || time < lava.get(c)!) lava.set(c, time);
        if (p.heightM[c] < 0) break;
        let next = -1;
        let lowest = Infinity;
        for (let k = neighborOffsets[c]; k < neighborOffsets[c + 1]; k++) {
          const n = neighbors[k];
          const h = p.heightM[n] + rng.range(-180, 180);
          if (h < lowest) {
            lowest = h;
            next = n;
          }
        }
        if (next < 0 || lowest > p.heightM[c] + 120) break;
        c = next;
        time += rng.range(35, 70);
      }
    }
    const lavaCells = [...lava.keys()];
    for (const c of lavaCells) p.heightM[c] += 50;
    this.markHeightsChanged(lavaCells);
    this.addScar(e.id, 'lava', e.minutes, lavaCells, lavaCells.map((c) => lava.get(c)!), lavaCells.map(() => 1), {
      active: 2.5 * DAY,
      tint: 250 * YEAR,
      damage: 1,
      recovery: 300 * YEAR,
      center: summit,
      radiusKm: radius,
    });

    // Lava sets the forests next to it on fire.
    const origins: { cell: number; time: number }[] = [];
    for (const c of lavaCells) {
      for (let k = neighborOffsets[c]; k < neighborOffsets[c + 1]; k++) {
        const n = neighbors[k];
        if (!lava.has(n)) origins.push({ cell: n, time: e.minutes + lava.get(c)! + HOUR });
      }
    }
    this.igniteFire(e, origins, rng, 160, false);

    // Ash falls downwind.
    const ashPath = this.trackCells(summit, rng.range(0, Math.PI * 2), 260, 1).path;
    const ashCenter = ashPath.length > 0 ? ashPath[ashPath.length - 1] : summit;
    const ashRadius = 700;
    const ash = this.cellsWithin(ashCenter, ashRadius);
    this.addScar(e.id, 'ash', e.minutes, ash.cells, ash.dist.map((d) => (d / ashRadius) * 0.6 * DAY), ash.dist.map((d) => 1 - d / ashRadius), {
      active: 0.5 * DAY,
      tint: 1.5 * YEAR,
      damage: 0.35,
      recovery: 6 * YEAR,
      center: ashCenter,
      radiusKm: ashRadius,
    });

    this.shifts.push({ eventId: e.id, kind: 'volcanicWinter', start: e.minutes, rampIn: 0.15 * YEAR, hold: 1.2 * YEAR, rampOut: 2.5 * YEAR, delta: -3.5, dust: 0.35 });
  }

  /** A wave from `center` floods low coasts within reach. `power` scales its size. */
  private tsunami(e: PowerEvent, center: number, power: number): void {
    const p = this.planet;
    let origin = center;
    if (p.heightM[origin] >= 0) {
      // Started on land: use the nearest sea within reach.
      const near = this.cellsWithin(center, 400);
      let best = Infinity;
      for (let i = 0; i < near.cells.length; i++) {
        if (p.heightM[near.cells[i]] < 0 && near.dist[i] < best) {
          best = near.dist[i];
          origin = near.cells[i];
        }
      }
    }
    const radius = 1600 * power;
    const speed = 11; // km per game minute (about 660 km/h)
    const area = this.cellsWithin(origin, radius);
    const cells: number[] = [];
    const delay: number[] = [];
    const strength: number[] = [];
    area.cells.forEach((c, i) => {
      const h = p.heightM[c];
      if (h < 0 || p.coastDistance[c] > 5) return;
      const d = area.dist[i];
      const runup = 25 + 300 * power * Math.pow(1 - d / radius, 0.7) - p.coastDistance[c] * 35;
      if (h >= runup) return;
      cells.push(c);
      delay.push(d / speed + p.coastDistance[c] * 25);
      strength.push(Math.min(1, (runup - h) / Math.max(40, runup)));
    });
    this.addScar(e.id, 'flood', e.minutes, cells, delay, strength, {
      active: 1.3 * DAY,
      tint: 20 * DAY,
      damage: 0.85,
      recovery: 10 * YEAR,
      center: origin,
      radiusKm: radius,
      speedKmPerMin: speed,
    });
    this.extinguish(cells, e.minutes, ['burn']);
  }

  private meteor(e: PowerEvent, rng: Rng): void {
    const p = this.planet;
    const r = 150;
    const wasSea = p.heightM[e.cell] < 0;
    const crater = this.cellsWithin(e.cell, r * 2);
    crater.cells.forEach((c, i) => {
      const x = crater.dist[i] / r;
      const delta = x < 1 ? -1900 * (1 - x * x) + 700 * x ** 4 : 700 * Math.exp(-(((x - 1) / 0.35) ** 2));
      p.heightM[c] += delta;
    });
    this.markHeightsChanged(crater.cells);
    this.ensureClimate();

    const zone = 480;
    const impact = this.cellsWithin(e.cell, zone);
    this.addScar(e.id, 'impact', e.minutes, impact.cells, impact.dist.map((d) => d / 25), impact.dist.map((d) => 1 - d / zone), {
      active: 0.5 * DAY,
      tint: 6 * YEAR,
      damage: 0.95,
      recovery: 25 * YEAR,
      center: e.cell,
      radiusKm: zone,
    });

    // The heat wave starts fires around the impact.
    const origins: { cell: number; time: number }[] = [];
    impact.cells.forEach((c, i) => {
      if (impact.dist[i] > zone * 0.6 && rng.chance(0.08)) origins.push({ cell: c, time: e.minutes + impact.dist[i] / 25 + HOUR });
    });
    this.igniteFire(e, origins, rng, 260, false);

    if (wasSea) this.tsunami(e, e.cell, 1.1);
    this.shifts.push({ eventId: e.id, kind: 'impactWinter', start: e.minutes, rampIn: 0.03 * YEAR, hold: 2 * YEAR, rampOut: 3 * YEAR, delta: -6, dust: 0.55 });
  }

  private brushStamp(kind: PowerKind, cell: number): void {
    const p = this.planet;
    const r = 125;
    const { cells, dist } = this.cellsWithin(cell, r);
    if (kind === 'forest') {
      let changed = false;
      for (const c of cells) {
        if (p.heightM[c] < 0 || this.planted[c]) continue;
        this.planted[c] = 1;
        this.changedCells.add(c);
        changed = true;
      }
      if (changed) {
        this.climateDirty = true;
      }
      return;
    }
    const sign = kind === 'raise' ? 1 : -1;
    cells.forEach((c, i) => {
      const f = (1 - (dist[i] / r) ** 2) ** 2;
      // Under water the brush works faster, so islands appear within a stroke or two.
      const amount = kind === 'raise' && p.heightM[c] < 0 ? 1100 : 420;
      p.heightM[c] = Math.max(-5000, Math.min(7500, p.heightM[c] + sign * amount * f));
    });
    this.markHeightsChanged(cells);
  }
}

const BLANK: CellState = {
  glow: 0,
  burning: false,
  char: 0,
  lavaHeat: 0,
  water: 0,
  wet: 0,
  dry: 0,
  green: 0,
  ash: 0,
  raining: false,
  veg: 1,
  burnt: false,
  lavaRock: false,
  storm: 0,
  bounty: 0,
  plague: false,
};

/** Which forest grows where the player plants one. */
export function plantedBiome(temperature: number): Biome {
  if (temperature < 6) return Biome.Taiga;
  if (temperature < 18) return Biome.TemperateForest;
  return Biome.Rainforest;
}
