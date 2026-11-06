/**
 * The living world: people and animal herds.
 *
 * Runs in fixed steps of 20 game minutes and draws all randomness from one
 * stored generator, so the same start plus the same events always gives the
 * same story. That is what makes rewinding and saving possible.
 *
 * People (milestone 3): hunger, thirst, sleep and health. They look for
 * water and food, sleep at night, stay with their group, flee from fire and
 * floods, get sick, and can die. Animals live in herds that graze, wander,
 * have young in spring and are hunted by wolves.
 */
import { DAYS_PER_YEAR, MINUTES_PER_DAY, dateFromMinutes, localSolarHours, seasonSignal, sunLongitude } from '../clock';
import { currentTemperature, longitudeOf } from '../planet/generate';
import { Biome } from '../planet/biomes';
import { FRESH_NONE } from '../planet/rivers';
import { Rng } from '../../core/rng';
import type { World } from '../world';
import type { PowerEvent } from '../powers';
import { personName } from './names';
import { SPECIES, SPECIES_IDS, habitatScore } from './species';
import type { DeathCause, FoodEntry, Herd, LifeData, LogKey, Person, Sex, SpeciesId } from './types';
import { CLOTH_COLORS, HAIR_COLORS } from './types';

/** Simulation step in game minutes. */
export const TICK = 20;
const DAY = MINUTES_PER_DAY;
const YEAR = DAY * DAYS_PER_YEAR;
const HERD_EVERY = 6;
const HERD_DT = TICK * HERD_EVERY;
const WALK_KM_PER_TICK = 2.2;
const FOOD_REGROW = 6 * DAY;
const MAX_PEOPLE = 300;
const MAX_HERDS = 500;
const MAX_LOG = 30;
/** A person can be revived for this long after death. */
export const REVIVE_WINDOW = 5 * DAY;

const FLAG_STARVING = 1;
const FLAG_PARCHED = 2;
const FLAG_FREEZING = 4;

/** How much food (berries, roots, shellfish) a biome offers, 0 … 1. */
const BIOME_FOOD: Partial<Record<Biome, number>> = {
  [Biome.Beach]: 0.45,
  [Biome.Grassland]: 0.75,
  [Biome.Steppe]: 0.45,
  [Biome.TemperateForest]: 1,
  [Biome.Rainforest]: 1,
  [Biome.Savanna]: 0.65,
  [Biome.Desert]: 0.05,
  [Biome.Taiga]: 0.6,
  [Biome.Tundra]: 0.25,
  [Biome.Mountains]: 0.12,
};

/** Mulberry32 with its state in the open, so it can be saved. */
class StateRng {
  constructor(public state: number) {}
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}

type RandomSource = { next(): number; range(a: number, b: number): number; int(a: number, b: number): number; chance(p: number): boolean };

export class Life {
  private data: LifeData;
  private readonly rng: StateRng;
  private readonly food = new Map<number, FoodEntry>();

  private constructor(data: LifeData) {
    this.data = data;
    this.rng = new StateRng(data.rng);
    for (const [cell, level, at] of data.food) this.food.set(cell, { level, at });
  }

  // ------------------------------------------------------------ creation, saving

  /** A new living world: six people near fresh water and herds all over the land. */
  static create(world: World, t: number): Life {
    const start = Math.floor(t / TICK) * TICK;
    const life = new Life({ t: start, rng: world.planet.seed ^ 0x5eed1e5, nextId: 1, people: [], herds: [], food: [] });
    const rng = new Rng(world.planet.seed).fork('first-people');
    const home = Life.findHome(world);
    for (let i = 0; i < 6; i++) life.addPerson(world, home, rng, i % 2 === 0 ? 'f' : 'm');
    life.spawnInitialHerds(world);
    return life;
  }

  static restore(data: LifeData): Life {
    return new Life(JSON.parse(JSON.stringify(data)) as LifeData);
  }

  /** A deep copy of the full state. */
  serialize(): LifeData {
    this.data.rng = this.rng.state;
    this.data.food = [...this.food.entries()].map(([cell, e]) => [cell, e.level, e.at]);
    return JSON.parse(JSON.stringify(this.data)) as LifeData;
  }

  get t(): number {
    return this.data.t;
  }

  get people(): readonly Person[] {
    return this.data.people;
  }

  get herds(): readonly Herd[] {
    return this.data.herds;
  }

  person(id: number): Person | undefined {
    return this.data.people.find((p) => p.id === id);
  }

  herd(id: number): Herd | undefined {
    return this.data.herds.find((h) => h.id === id);
  }

  population(): number {
    let n = 0;
    for (const p of this.data.people) if (p.alive) n++;
    return n;
  }

  /** A green place close to fresh water, as a home for the first people. */
  static findHome(world: World): number {
    const p = world.planet;
    let best = 0;
    let bestScore = -Infinity;
    for (let c = 0; c < p.cellCount; c += 3) {
      if (p.heightM[c] < 0 || p.biome[c] === Biome.Ice || p.biome[c] === Biome.Desert) continue;
      const lat = Math.abs(Math.asin(p.positions[c * 3 + 1]));
      let water = p.fresh[c] !== FRESH_NONE ? 2 : 0;
      for (let k = p.neighborOffsets[c]; k < p.neighborOffsets[c + 1] && water === 0; k++) if (p.fresh[p.neighbors[k]] !== FRESH_NONE) water = 1;
      const food = BIOME_FOOD[p.biome[c] as Biome] ?? 0;
      // Mild, low and green: easy first years.
      const mild = -Math.abs(p.temperature[c] - 16) / 5 - p.seasonAmplitude[c] / 12;
      const score = water * 1.5 + food * 2 + mild - Math.abs(lat - 0.45) - Math.max(0, p.heightM[c] - 700) / 800 + ((c * 2654435761) % 1000) / 3000;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }

  // ------------------------------------------------------------ time

  /** Runs the simulation up to time T (in whole ticks). Returns the number of ticks run. */
  advanceTo(T: number, world: World, maxTicks = Infinity): number {
    let n = 0;
    while (this.data.t + TICK <= T && n < maxTicks) {
      this.data.t += TICK;
      this.step(world);
      n++;
    }
    return n;
  }

  private step(world: World): void {
    const t = this.data.t;
    for (const p of this.data.people) if (p.alive) this.updatePerson(p, world, t);
    // Sickness spreads among people in the same place.
    for (const p of this.data.people) {
      if (!p.alive || p.sick <= 0) continue;
      for (const q of this.data.people) {
        if (q === p || !q.alive || q.sick > 0 || q.immune || q.cell !== p.cell) continue;
        if (this.rng.chance(0.006)) this.makeSick(q);
      }
    }
    const tick = Math.round(t / TICK);
    if (tick % HERD_EVERY === 0) {
      for (const h of this.data.herds) if (h.count > 0) this.updateHerd(h, world, t);
      this.data.herds = this.data.herds.filter((h) => h.count > 0);
    }
    if (tick % 360 === 0) this.cleanFood(world, t);
  }

  // ------------------------------------------------------------ people

  private addPerson(world: World, cell: number, rng: RandomSource, sex?: Sex): Person | null {
    if (this.population() >= MAX_PEOPLE) return null;
    const s: Sex = sex ?? (rng.chance(0.5) ? 'f' : 'm');
    const nameRng = new Rng(Math.floor(rng.next() * 0xffffffff));
    const p: Person = {
      id: this.data.nextId++,
      name: personName(nameRng, s),
      sex: s,
      born: this.data.t - rng.range(16, 38) * YEAR,
      look: {
        skin: rng.next(),
        hair: Math.floor(rng.next() * HAIR_COLORS.length),
        height: rng.range(0.9, 1.1) * (s === 'm' ? 1.04 : 0.97),
        clothes: Math.floor(rng.next() * CLOTH_COLORS.length),
      },
      cell: Life.nearestLand(world, cell),
      next: -1,
      progress: 0,
      path: [],
      goal: 'none',
      action: 'idle',
      actionUntil: this.data.t,
      hunger: rng.range(0.1, 0.3),
      thirst: rng.range(0.1, 0.3),
      energy: rng.range(0.7, 1),
      health: 1,
      sick: 0,
      immune: false,
      spot: [rng.range(-12, 12), rng.range(-12, 12)],
      alive: true,
      log: [],
      flags: 0,
    };
    this.log(p, 'created');
    this.data.people.push(p);
    return p;
  }

  private log(p: Person, key: LogKey, cause?: DeathCause): void {
    p.log.push(cause ? { t: this.data.t, key, cause } : { t: this.data.t, key });
    if (p.log.length > MAX_LOG) p.log.splice(1, p.log.length - MAX_LOG);
  }

  private die(p: Person, cause: DeathCause): void {
    if (!p.alive) return;
    p.alive = false;
    p.died = this.data.t;
    p.cause = cause;
    p.next = -1;
    p.path = [];
    p.action = 'idle';
    p.goal = 'none';
    this.log(p, 'died', cause);
  }

  private makeSick(p: Person): void {
    if (p.sick > 0 || p.immune || !p.alive) return;
    p.sick = this.rng.range(4, 9) * DAY;
    this.log(p, 'sick');
  }

  private hurt(p: Person, amount: number, cause: DeathCause): void {
    p.health -= amount;
    p.hurtBy = cause;
  }

  localHours(world: World, cell: number, t: number): number {
    const pos = world.planet.positions;
    const lon = longitudeOf(pos[cell * 3], pos[cell * 3 + 2]);
    return localSolarHours(lon, sunLongitude((t % DAY) / DAY));
  }

  temperatureAt(world: World, cell: number, t: number): number {
    const season = seasonSignal((t % YEAR) / YEAR);
    return currentTemperature(world.planet, cell, season, this.localHours(world, cell, t)) + world.globalTemperature(t);
  }

  private hasWater(world: World, cell: number, raining: boolean): boolean {
    return world.planet.fresh[cell] !== FRESH_NONE || raining;
  }

  private updatePerson(p: Person, world: World, t: number): void {
    const dt = TICK / DAY;
    if (p.action === 'carried') {
      if (t < p.actionUntil) return;
      p.action = 'idle';
    }
    if (world.planet.heightM[p.cell] < 0) {
      // The land sank under the person: swim to the nearest shore.
      p.cell = Life.nearestLand(world, p.cell);
      p.next = -1;
      p.path = [];
      this.hurt(p, 0.2, 'flood');
    }
    const st = world.cellState(p.cell, t);

    // Deadly places.
    if (st.lavaHeat > 0.05) return this.die(p, 'lava');
    if (st.glow > 0.5 && !st.burning) return this.die(p, 'impact');
    let danger = false;
    if (st.burning) {
      this.hurt(p, 0.22, 'fire');
      danger = true;
      if (!(p.flags & 8)) {
        p.flags |= 8;
        this.log(p, 'fledFire');
      }
    }
    if (st.water > 0.2) {
      danger = true;
      if (st.water > 0.55 && this.rng.chance(0.2)) return this.die(p, 'flood');
      this.hurt(p, 0.08, 'flood');
      if (!(p.flags & 16)) {
        p.flags |= 16;
        this.log(p, 'fledFlood');
      }
    }
    if (st.storm > 0.6) this.hurt(p, 0.02 * st.storm, 'storm');
    if (!danger) p.flags &= ~(8 | 16);

    // Needs.
    p.hunger = Math.min(1, p.hunger + 0.42 * dt);
    p.thirst = Math.min(1, p.thirst + (st.raining ? 0 : 0.55 * dt));
    if (st.raining) p.thirst = Math.max(0, p.thirst - 0.04);
    p.energy = Math.max(0, Math.min(1, p.energy + (p.action === 'sleep' ? 2.4 : -0.85) * dt));

    if (p.hunger >= 1) {
      this.hurt(p, 0.28 * dt, 'hunger');
      if (!(p.flags & FLAG_STARVING)) {
        p.flags |= FLAG_STARVING;
        this.log(p, 'starving');
      }
    } else if (p.hunger < 0.5) p.flags &= ~FLAG_STARVING;
    if (p.thirst >= 1) {
      this.hurt(p, 0.42 * dt, 'thirst');
      if (!(p.flags & FLAG_PARCHED)) {
        p.flags |= FLAG_PARCHED;
        this.log(p, 'parched');
      }
    } else if (p.thirst < 0.5) p.flags &= ~FLAG_PARCHED;

    const temp = this.temperatureAt(world, p.cell, t);
    if (temp < -10) {
      this.hurt(p, ((-10 - temp) / 10) * 0.18 * dt, 'cold');
      if (!(p.flags & FLAG_FREEZING)) {
        p.flags |= FLAG_FREEZING;
        this.log(p, 'freezing');
      }
    } else if (temp > -5) p.flags &= ~FLAG_FREEZING;

    if (st.plague && !p.immune && p.sick <= 0 && this.rng.chance(0.03)) this.makeSick(p);
    if (p.sick > 0) {
      this.hurt(p, 0.11 * dt, 'sickness');
      p.sick -= TICK;
      if (p.sick <= 0) {
        p.sick = 0;
        p.immune = true;
        this.log(p, 'recovered');
      }
    } else if (p.hunger < 0.6 && p.thirst < 0.6 && !danger) {
      p.health = Math.min(1, p.health + 0.2 * dt);
    }
    if (p.health <= 0) return this.die(p, p.hurtBy ?? 'hunger');

    // Doing things.
    if (danger && p.goal !== 'safety') {
      this.flee(p, world, t);
    } else if (p.action === 'walk') {
      const urgent = (p.thirst > 0.7 && p.goal !== 'water') || (p.hunger > 0.75 && p.goal !== 'food' && p.goal !== 'water');
      if (urgent) this.decide(p, world, t);
      else this.walk(p, world, t);
    } else if (p.action === 'gather') {
      const bite = this.eat(world, p.cell, t, 0.012);
      p.hunger = Math.max(0, p.hunger - bite * 9);
      if (bite < 0.004 || p.hunger <= 0.02 || t >= p.actionUntil) this.decide(p, world, t);
    } else if (p.action === 'drink') {
      p.thirst = Math.max(0, p.thirst - 0.4);
      if (p.thirst <= 0 || t >= p.actionUntil) this.decide(p, world, t);
    } else if (p.action === 'sleep') {
      if (t >= p.actionUntil || (p.energy >= 1 && this.isDay(world, p.cell, t))) this.decide(p, world, t);
      else if (p.thirst > 0.85 || p.hunger > 0.9) this.decide(p, world, t);
    } else if (t >= p.actionUntil) {
      this.decide(p, world, t);
    }
  }

  private isDay(world: World, cell: number, t: number): boolean {
    const h = this.localHours(world, cell, t);
    return h >= 6 && h < 20.5;
  }

  /** Chooses what to do next. */
  private decide(p: Person, world: World, t: number): void {
    const planet = world.planet;
    const st = world.cellState(p.cell, t);
    p.goal = 'none';
    p.next = -1;
    p.path = [];
    p.progress = 0;

    if (p.thirst > 0.5) {
      if (this.hasWater(world, p.cell, st.raining)) return this.start(p, 'drink', t, 60);
      if (this.goTo(p, world, (c) => planet.fresh[c] !== FRESH_NONE, 18, 'water')) return;
    }
    if (p.hunger > 0.45) {
      if (this.foodAt(world, p.cell, t) > 0.2) return this.start(p, 'gather', t, 180, true);
      if (this.goTo(p, world, (c) => this.foodAt(world, c, t) > 0.35, 12, 'food')) return;
    }
    const hours = this.localHours(world, p.cell, t);
    const night = hours < 5.5 || hours >= 21;
    if ((night && p.energy < 0.85) || p.energy < 0.15) {
      const wake = ((6.5 - hours + 24) % 24) * 60;
      return this.start(p, 'sleep', t, night ? Math.max(60, wake) : 240);
    }
    // Stay with the group: follow the nearest older person if far away.
    const leader = this.leaderOf(p, world);
    if (leader && leader.cell !== p.cell && world.kmBetween(leader.cell, p.cell) > world.kmPerCell * 1.5) {
      if (this.goTo(p, world, (c) => c === leader.cell, 25, 'group')) return;
    }
    // Leaders sometimes move on to a better place.
    if (!leader && this.rng.chance(0.25)) {
      const target = this.betterPlace(p, world, t);
      if (target >= 0 && this.goTo(p, world, (c) => c === target, 6, 'wander')) return;
    }
    this.start(p, 'rest', t, this.rng.range(60, 200), true);
  }

  private start(p: Person, action: Person['action'], t: number, minutes: number, newSpot = false): void {
    p.action = action;
    p.actionUntil = t + Math.round(minutes / TICK) * TICK;
    if (newSpot) p.spot = [this.rng.range(-14, 14), this.rng.range(-14, 14)];
  }

  /** The nearest person created earlier within six cells (the group's elder), if any. */
  private leaderOf(p: Person, world: World): Person | null {
    let best: Person | null = null;
    let bestKm = world.kmPerCell * 6;
    for (const q of this.data.people) {
      if (!q.alive || q.id >= p.id) continue;
      const km = world.kmBetween(q.cell, p.cell);
      if (km < bestKm) {
        bestKm = km;
        best = q;
      }
    }
    return best;
  }

  /** The best place within a few days' walk: food, fresh water and safety. −1 if here is best. */
  private betterPlace(p: Person, world: World, t: number): number {
    const planet = world.planet;
    const score = (c: number, steps: number) => {
      const st = world.cellState(c, t);
      if (st.burning || st.water > 0.1 || st.lavaHeat > 0) return -1;
      let water = planet.fresh[c] !== FRESH_NONE ? 0.6 : 0;
      for (let k = planet.neighborOffsets[c]; k < planet.neighborOffsets[c + 1] && water === 0; k++) {
        if (planet.fresh[planet.neighbors[k]] !== FRESH_NONE) water = 0.3;
      }
      if (water === 0) return -1; // never lead the group away from water
      return this.foodAt(world, c, t) * 1.5 + water - steps * 0.06 + this.rng.next() * 0.15;
    };
    const here = Math.max(0, score(p.cell, 0));
    let best = -1;
    let bestScore = here + 0.25;
    const seen = new Set([p.cell]);
    let frontier = [p.cell];
    for (let step = 1; step <= 4; step++) {
      const next: number[] = [];
      for (const c of frontier) {
        for (let k = planet.neighborOffsets[c]; k < planet.neighborOffsets[c + 1]; k++) {
          const n = planet.neighbors[k];
          if (seen.has(n) || planet.heightM[n] < 0) continue;
          seen.add(n);
          next.push(n);
          const s = score(n, step);
          if (s > bestScore) {
            bestScore = s;
            best = n;
          }
        }
      }
      frontier = next;
    }
    return best;
  }

  /** Breadth-first search over land to the nearest cell that matches. */
  private goTo(p: Person, world: World, match: (c: number) => boolean, maxSteps: number, goal: Person['goal']): boolean {
    const planet = world.planet;
    const prev = new Map<number, number>([[p.cell, -1]]);
    let frontier = [p.cell];
    for (let step = 0; step < maxSteps && frontier.length > 0; step++) {
      const nextFrontier: number[] = [];
      for (const c of frontier) {
        for (let k = planet.neighborOffsets[c]; k < planet.neighborOffsets[c + 1]; k++) {
          const n = planet.neighbors[k];
          if (prev.has(n) || planet.heightM[n] < 0) continue;
          prev.set(n, c);
          if (match(n)) {
            const path: number[] = [];
            for (let x = n; x !== p.cell; x = prev.get(x)!) path.push(x);
            path.reverse();
            p.goal = goal;
            p.next = path.shift()!;
            p.path = path;
            p.progress = 0;
            p.action = 'walk';
            return true;
          }
          nextFrontier.push(n);
        }
      }
      frontier = nextFrontier;
    }
    return false;
  }

  private walk(p: Person, world: World, t: number): void {
    if (p.next < 0) return this.arrive(p, world, t);
    const km = Math.max(1, world.kmBetween(p.cell, p.next));
    const speed = WALK_KM_PER_TICK * (p.goal === 'safety' ? 1.7 : 1) * (p.sick > 0 ? 0.6 : 1) * (p.energy < 0.1 ? 0.6 : 1);
    p.progress += speed / km;
    if (p.progress >= 1) {
      p.cell = p.next;
      p.progress = 0;
      p.next = p.path.shift() ?? -1;
      if (p.next >= 0 && world.planet.heightM[p.next] < 0) p.next = -1;
      if (p.next < 0) this.arrive(p, world, t);
    }
  }

  private arrive(p: Person, world: World, t: number): void {
    const goal = p.goal;
    p.next = -1;
    p.path = [];
    if (goal === 'water') return this.start(p, 'drink', t, 60, true);
    if (goal === 'food') return this.start(p, 'gather', t, 180, true);
    this.decide(p, world, t);
  }

  private flee(p: Person, world: World, t: number): void {
    const planet = world.planet;
    let best = -1;
    let bestScore = -Infinity;
    for (let k = planet.neighborOffsets[p.cell]; k < planet.neighborOffsets[p.cell + 1]; k++) {
      const n = planet.neighbors[k];
      if (planet.heightM[n] < 0) continue;
      const st = world.cellState(n, t);
      const bad = (st.burning ? 2 : 0) + st.water * 3 + (st.lavaHeat > 0 ? 5 : 0) + st.glow;
      const s = -bad + this.rng.next() * 0.2;
      if (s > bestScore) {
        bestScore = s;
        best = n;
      }
    }
    if (best < 0) return;
    p.goal = 'safety';
    p.action = 'walk';
    p.next = best;
    p.path = [];
    p.progress = 0;
    p.actionUntil = t + 6 * 60;
  }

  // ------------------------------------------------------------ food

  /** How much food a cell can hold right now (season, fire damage, blessings). */
  capacity(world: World, cell: number, t: number): number {
    const planet = world.planet;
    if (planet.heightM[cell] < 0) return 0;
    let cap = BIOME_FOOD[planet.biome[cell] as Biome] ?? 0;
    if (cap <= 0) return 0;
    const st = world.cellState(cell, t);
    cap *= 0.15 + 0.85 * st.veg;
    const temp = this.temperatureAt(world, cell, t);
    cap *= temp < -2 ? 0.3 : temp < 6 ? 0.65 : 1;
    if (st.bounty > 0) cap = Math.min(1.6, cap * (1 + st.bounty) + 0.3 * st.bounty);
    return cap;
  }

  foodAt(world: World, cell: number, t: number): number {
    const cap = this.capacity(world, cell, t);
    const e = this.food.get(cell);
    if (!e) return cap;
    const level = Math.min(e.level, cap);
    return cap - (cap - level) * Math.exp(-(t - e.at) / FOOD_REGROW);
  }

  private eat(world: World, cell: number, t: number, amount: number): number {
    const now = this.foodAt(world, cell, t);
    const take = Math.min(now, amount);
    this.food.set(cell, { level: now - take, at: t });
    return take;
  }

  private cleanFood(world: World, t: number): void {
    for (const [cell, e] of [...this.food.entries()]) {
      const cap = this.capacity(world, cell, t);
      const level = cap - (cap - Math.min(e.level, cap)) * Math.exp(-(t - e.at) / FOOD_REGROW);
      if (cap - level < 0.02) this.food.delete(cell);
    }
  }

  // ------------------------------------------------------------ animals

  private spawnInitialHerds(world: World): void {
    const planet = world.planet;
    let land = 0;
    for (let c = 0; c < planet.cellCount; c++) if (planet.heightM[c] >= 0) land++;
    const herbivores = Math.round(land / 150);
    const plan: [SpeciesId, number][] = [
      ['deer', Math.round(herbivores * 0.45)],
      ['bison', Math.round(herbivores * 0.4)],
      ['mammoth', Math.round(herbivores * 0.15)],
      ['wolf', Math.round(herbivores * 0.18)],
    ];
    for (const [species, n] of plan) {
      let placed = 0;
      for (let attempt = 0; attempt < n * 40 && placed < n; attempt++) {
        const c = this.rng.int(0, planet.cellCount - 1);
        if (planet.heightM[c] < 0) continue;
        const h = habitatScore(SPECIES[species], planet.biome[c], planet.temperature[c]);
        if (h < 0.5 || !this.rng.chance(h)) continue;
        this.addHerd(species, c, this.rng.int(...SPECIES[species].startCount));
        placed++;
      }
    }
  }

  private addHerd(species: SpeciesId, cell: number, count: number): Herd | null {
    if (this.data.herds.length >= MAX_HERDS) return null;
    const h: Herd = { id: this.data.nextId++, species, count, cell, next: -1, progress: 0, hunger: 0.2, bornYear: dateFromMinutes(this.data.t).year, prey: -1 };
    this.data.herds.push(h);
    return h;
  }

  private updateHerd(h: Herd, world: World, t: number): void {
    const sp = SPECIES[h.species];
    const planet = world.planet;
    if (planet.heightM[h.cell] < 0) {
      h.cell = Life.nearestLand(world, h.cell);
      h.next = -1;
      if (planet.heightM[h.cell] < 0) {
        h.count = 0;
        return;
      }
    }
    const st = world.cellState(h.cell, t);
    if (st.lavaHeat > 0.05 || (st.glow > 0.5 && !st.burning)) {
      h.count = 0;
      return;
    }
    let danger = false;
    if (st.burning) {
      h.count -= Math.ceil(h.count * 0.25);
      danger = true;
    }
    if (st.water > 0.3) {
      h.count -= Math.ceil(h.count * 0.15);
      danger = true;
    }
    if (st.plague && this.rng.chance(0.25)) h.count -= 1;
    if (st.storm > 0.7 && this.rng.chance(0.2)) h.count -= 1;
    if (h.count <= 0) return;

    // Young are born once each spring when the herd is well fed.
    const date = dateFromMinutes(t);
    if (date.season === 0 && date.dayOfSeason >= 3 && h.bornYear !== date.year && h.hunger < 0.5 && this.data.herds.length < MAX_HERDS) {
      h.count += Math.max(1, Math.round(h.count * (sp.predator ? 0.35 : 0.3)));
      h.bornYear = date.year;
    }

    // Eating.
    if (sp.predator) {
      h.hunger = Math.min(1, h.hunger + 0.022);
    } else {
      const need = h.count * sp.appetite;
      const got = this.eat(world, h.cell, t, need);
      h.hunger = Math.max(0, Math.min(1, h.hunger + 0.05 - 0.14 * (got / Math.max(1e-6, need))));
    }
    if (h.hunger >= 1) {
      // Starvation takes a share of the herd each step (on average), not a fixed number.
      const loss = h.count * (sp.predator ? 0.004 : 0.012);
      h.count -= Math.floor(loss) + (this.rng.chance(loss - Math.floor(loss)) ? 1 : 0);
    }
    if (h.count <= 0) return;

    // Moving.
    if (h.next >= 0) {
      h.progress += (sp.speed * (HERD_DT / 60) * (danger ? 1.8 : 1)) / Math.max(1, world.kmBetween(h.cell, h.next));
      if (h.progress >= 1) {
        h.cell = h.next;
        h.next = -1;
        h.progress = 0;
      }
    } else if (sp.predator) {
      this.hunt(h, world);
    } else {
      const here = this.pasture(h, world, h.cell, t);
      if (danger || here < 0.25 || h.hunger > 0.55 || this.rng.chance(0.03)) {
        let best = -1;
        let bestScore = danger ? -Infinity : here * 1.1;
        for (let k = planet.neighborOffsets[h.cell]; k < planet.neighborOffsets[h.cell + 1]; k++) {
          const n = planet.neighbors[k];
          const s = this.pasture(h, world, n, t) + this.rng.next() * 0.05;
          if (s > bestScore) {
            bestScore = s;
            best = n;
          }
        }
        if (best >= 0) h.next = best;
      }
    }

    // Big herds split.
    if (h.count > sp.maxCount && this.data.herds.length < MAX_HERDS) {
      const half = Math.floor(h.count / 2);
      h.count -= half;
      const child = this.addHerd(h.species, h.cell, half);
      if (child) child.hunger = h.hunger;
    }
  }

  /** How good a cell is for a herd to graze (0 = not at all). */
  private pasture(h: Herd, world: World, cell: number, t: number): number {
    const planet = world.planet;
    if (planet.heightM[cell] < 0) return 0;
    const st = world.cellState(cell, t);
    if (st.burning || st.lavaHeat > 0 || st.water > 0.2) return 0;
    const habitat = habitatScore(SPECIES[h.species], planet.biome[cell], planet.temperature[cell] + world.globalTemperature(t));
    return habitat * (0.2 + this.foodAt(world, cell, t));
  }

  private hunt(h: Herd, world: World): void {
    const planet = world.planet;
    if (h.hunger < 0.3) {
      if (this.rng.chance(0.05)) {
        const k = this.rng.int(planet.neighborOffsets[h.cell], planet.neighborOffsets[h.cell + 1] - 1);
        const n = planet.neighbors[k];
        if (planet.heightM[n] >= 0 && habitatScore(SPECIES.wolf, planet.biome[n], planet.temperature[n]) > 0.2) h.next = n;
      }
      return;
    }
    let prey = h.prey >= 0 ? this.herd(h.prey) : undefined;
    if (!prey || prey.count <= 0 || world.kmBetween(prey.cell, h.cell) > world.kmPerCell * 11) {
      prey = undefined;
      let bestKm = world.kmPerCell * 10;
      for (const o of this.data.herds) {
        if (o.count <= 0 || SPECIES[o.species].predator) continue;
        const km = world.kmBetween(o.cell, h.cell);
        if (km < bestKm) {
          bestKm = km;
          prey = o;
        }
      }
      h.prey = prey ? prey.id : -1;
    }
    if (!prey) {
      // Nothing to hunt nearby: roam.
      const k = this.rng.int(planet.neighborOffsets[h.cell], planet.neighborOffsets[h.cell + 1] - 1);
      const n = planet.neighbors[k];
      if (planet.heightM[n] >= 0) h.next = n;
      return;
    }
    if (prey.cell === h.cell) {
      if (prey.species === 'mammoth' && !this.rng.chance(0.3)) return;
      const kills = Math.min(prey.count, 1 + (this.rng.chance(0.35) ? 1 : 0) + (h.count > 8 ? 1 : 0));
      prey.count -= kills;
      h.hunger = Math.max(0, h.hunger - 0.55 * kills);
      return;
    }
    // Step toward the prey.
    let best = -1;
    let bestKm = Infinity;
    for (let k = planet.neighborOffsets[h.cell]; k < planet.neighborOffsets[h.cell + 1]; k++) {
      const n = planet.neighbors[k];
      if (planet.heightM[n] < 0) continue;
      const km = world.kmBetween(n, prey.cell);
      if (km < bestKm) {
        bestKm = km;
        best = n;
      }
    }
    if (best >= 0) h.next = best;
  }

  // ------------------------------------------------------------ powers

  static nearestLand(world: World, cell: number): number {
    const planet = world.planet;
    if (planet.heightM[cell] >= 0) return cell;
    const seen = new Set([cell]);
    let frontier = [cell];
    for (let step = 0; step < 10; step++) {
      const next: number[] = [];
      for (const c of frontier) {
        for (let k = planet.neighborOffsets[c]; k < planet.neighborOffsets[c + 1]; k++) {
          const n = planet.neighbors[k];
          if (seen.has(n)) continue;
          if (planet.heightM[n] >= 0) return n;
          seen.add(n);
          next.push(n);
        }
      }
      frontier = next;
    }
    return cell;
  }

  /** What a power does to the living (its effect on the land is handled by the World). */
  applyEvent(e: PowerEvent, world: World): void {
    const rng = new Rng(e.seed).fork('life');
    const t = this.data.t;
    const within = (km: number) => this.data.people.filter((p) => p.alive && world.kmBetween(p.cell, e.cell) <= km);
    switch (e.kind) {
      case 'lightning':
        for (const p of this.data.people) if (p.alive && p.cell === e.cell) this.die(p, 'lightning');
        for (const h of this.data.herds) if (h.cell === e.cell) h.count -= Math.ceil(h.count * 0.3);
        break;
      case 'quake':
        for (const p of within(420)) {
          const km = world.kmBetween(p.cell, e.cell);
          if (km < 140 && rng.chance(0.3)) this.die(p, 'quake');
          else this.hurt(p, 0.3 * (1 - km / 420), 'quake');
        }
        break;
      case 'heal':
        for (const p of within(170)) {
          p.health = 1;
          p.sick = 0;
          p.immune = true;
          p.hunger = Math.min(p.hunger, 0.25);
          p.thirst = Math.min(p.thirst, 0.25);
          this.log(p, 'healed');
        }
        break;
      case 'revive': {
        const p = e.target !== undefined ? this.person(e.target) : undefined;
        if (p && !p.alive && p.died !== undefined && t - p.died <= REVIVE_WINDOW) {
          p.alive = true;
          p.health = 1;
          p.hunger = 0.2;
          p.thirst = 0.2;
          p.energy = 1;
          p.sick = 0;
          p.cause = undefined;
          p.died = undefined;
          p.cell = Life.nearestLand(world, p.cell);
          p.action = 'rest';
          p.actionUntil = t + 3 * 60;
          this.log(p, 'revived');
        }
        break;
      }
      case 'createPeople': {
        const count = Math.max(1, Math.min(10, e.extra ?? 1));
        for (let i = 0; i < count; i++) this.addPerson(world, e.cell, rng);
        break;
      }
      case 'spawnAnimals': {
        const species = SPECIES_IDS[Math.max(0, Math.min(SPECIES_IDS.length - 1, e.extra ?? 0))];
        const [lo, hi] = SPECIES[species].startCount;
        this.addHerd(species, Life.nearestLand(world, e.cell), rng.int(lo, hi));
        break;
      }
      case 'smite': {
        const p = e.target !== undefined ? this.person(e.target) : undefined;
        if (p?.alive) this.die(p, 'god');
        break;
      }
      case 'plague':
        for (const p of within(450)) if (!p.immune && rng.chance(0.6)) this.makeSick(p);
        break;
      case 'move': {
        const p = e.target !== undefined ? this.person(e.target) : undefined;
        if (p?.alive) {
          p.carriedFrom = p.cell;
          p.carriedAt = t;
          p.cell = Life.nearestLand(world, e.cell);
          p.next = -1;
          p.path = [];
          p.progress = 0;
          p.goal = 'none';
          p.action = 'carried';
          p.actionUntil = t + 2 * 60;
          this.log(p, 'carried');
        }
        break;
      }
      case 'harvest':
        for (const cell of [...this.food.keys()]) if (world.kmBetween(cell, e.cell) <= 400) this.food.delete(cell);
        break;
      default:
        break;
    }
  }
}
