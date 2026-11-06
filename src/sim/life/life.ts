/**
 * The living world: people, their groups and animal herds.
 *
 * Runs in fixed steps of 20 game minutes and draws all randomness from one
 * stored generator, so the same start plus the same events always gives the
 * same story. That is what makes rewinding and saving possible.
 *
 * People have needs (hunger, thirst, sleep, company), a character, a mood
 * made of many small reasons, opinions of each other and a memory of what
 * happened to them. They talk, flirt, quarrel and comfort each other, become
 * couples, have children who inherit looks and character, grow old and die.
 * Each group follows a leader; crowded groups split and move away.
 *
 * Animals live in herds that graze, wander, have young in spring and are
 * hunted by wolves.
 */
import { DAYS_PER_YEAR, MINUTES_PER_DAY, dateFromMinutes, localSolarHours, seasonSignal, sunLongitude } from '../clock';
import { currentTemperature, longitudeOf } from '../planet/generate';
import { Biome } from '../planet/biomes';
import { FRESH_NONE } from '../planet/rivers';
import { Rng } from '../../core/rng';
import type { World } from '../world';
import type { PowerEvent, PowerKind } from '../powers';
import { personName } from './names';
import { SPECIES, SPECIES_IDS, habitatScore } from './species';
import { childLook, childTraits, founderLook, hashUnit, randomTraits, type RandomSource } from './genetics';
import { FLAG_FREEZING, moodReasons, moodValue, type MoodReason } from './mood';
import { FaithSystem } from './faith';
import { TribeSystem } from './tribes';
import { CivSystem } from './civ';
import { PoliticsSystem } from './politics';
import {
  BIT,
  INVENTION_IDS,
  INVENTIONS,
  circumstanceFactor,
  foresty,
  nextSteps,
  stony,
  type Circumstances,
  type InventionId,
  type Task,
} from './inventions';
import type {
  ArchivedPerson,
  Band,
  ChatKind,
  ChronicleEntry,
  ChronicleKey,
  DeathCause,
  FoodEntry,
  Herd,
  LifeData,
  LogEntry,
  LogKey,
  MoodKey,
  Person,
  Sex,
  SpeciesId,
  SpeciesRecord,
  Structure,
} from './types';
import { T_AGGRESSIVE, T_AMBITIOUS, T_BRAVE, T_CLEVER, T_CURIOUS, T_DILIGENT, T_KIND, TRAITS } from './types';

/** Simulation step in game minutes. */
export const TICK = 20;
/** During a time skip the simulation takes steps of this many ticks (2 hours). */
export const COARSE = 6;
const DAY = MINUTES_PER_DAY;
const YEAR = DAY * DAYS_PER_YEAR;
const TICKS_PER_DAY = DAY / TICK;
const HERD_EVERY = 6;
const HERD_DT = TICK * HERD_EVERY;
const WALK_KM_PER_TICK = 2.2;
const FOOD_REGROW = 6 * DAY;
const MAX_PEOPLE = 300;
const MAX_HERDS = 500;
const MAX_LOG = 24;
const MAX_RELS = 16;
/** A person can be revived for this long after death. */
export const REVIVE_WINDOW = 5 * DAY;
/** Three quarters of a year. */
export const PREGNANCY = 30 * DAY;
/** Age (years) from which people can become a couple, and lead or leave a group. */
export const ADULT_AGE = 16;

const FLAG_STARVING = 1;
const FLAG_PARCHED = 2;

/** Actions that do something for the group when they end. */
const WORK_ACTIONS = new Set<Person['action']>(['hunt', 'fish', 'build', 'heal', 'teach', 'fire', 'pray', 'farm']);

/** Lines in the life story that are kept when someone is archived. */
const MAJOR_LOG = new Set<LogKey>([
  'created',
  'born',
  'partner',
  'separated',
  'childBorn',
  'twins',
  'grief',
  'leader',
  'emigrated',
  'lucky',
  'blessedChild',
  'healed',
  'revived',
  'carried',
  'inLove',
  'madePeace',
  'invented',
  'teacher',
  'shaman',
  'answered',
  'died',
]);

/** Powers that the chronicle mentions. */
const CHRONICLED: ReadonlySet<PowerKind> = new Set<PowerKind>([
  'fire',
  'storm',
  'quake',
  'volcano',
  'tsunami',
  'meteor',
  'iceAge',
  'heatAge',
  'drought',
  'harvest',
  'heal',
  'plague',
  'spawnAnimals',
]);

const POPULATION_MARKS = [10, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 1000000, 10000000, 100000000, 1000000000];
/** Below this population every birth and death goes into the chronicle. */
const SMALL_WORLD = 40;
const MAX_STRUCTURES = 220;
/** Meat portions from one animal. */
const MEAT: Record<SpeciesId, number> = { deer: 4, bison: 6, mammoth: 14, wolf: 0 };
/** Gene drift per generation toward what suits the place. */
const SELECTION = 0.03;
/** How far genes must move from a species' start to form a new species. */
const SPECIATION = 0.3;

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

export type LifePhase = 'baby' | 'child' | 'youth' | 'adult' | 'elder';

export function phaseOf(age: number): LifePhase {
  return age < 3 ? 'baby' : age < 13 ? 'child' : age < 18 ? 'youth' : age < 55 ? 'adult' : 'elder';
}

/** Why a whisper or blessing cannot be used on someone (checked before it is used). */
export type PowerBlock = 'young' | 'alreadyLeader' | 'noEnemies' | 'noPartner' | 'pregnant' | 'samePerson' | 'noIdea' | 'nothingToTeach';

/** What a power did to the living (for messages; replays ignore it). */
export interface EventOutcome {
  person?: number;
  result?: 'accepted' | 'resisted' | 'noPlace';
  /** A whispered idea: what was invented. */
  invention?: InventionId;
}

/** Mulberry32 with its state in the open, so it can be saved. */
class StateRng implements RandomSource {
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

type Someone = Person | ArchivedPerson;

function isLiving(x: Someone | undefined): x is Person {
  return !!x && 'alive' in x;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export class Life {
  private data: LifeData;
  /** The world's random generator (systems in other files draw from it too). */
  readonly rng: StateRng;
  private readonly food = new Map<number, FoodEntry>();
  /** Everyone, living, recently dead and archived. */
  private readonly byId = new Map<number, Someone>();
  private readonly bandById = new Map<number, Band>();
  private bandsChecked = false;
  /** The idea a whisper gave (for the message). */
  private idea: InventionId | undefined;
  /** Belief and religion (state lives in the data). */
  readonly faith = new FaithSystem(this);
  readonly tribes = new TribeSystem(this);
  readonly civ = new CivSystem(this);
  readonly politics = new PoliticsSystem(this);
  /** The world during a step (not saved). */
  private stepWorld: World | null = null;
  /** How many talks one talk stands for (time skip). */
  private weight = 1;
  private readonly byCell = new Map<number, Person[]>();
  private memberCache: Map<number, Person[]> | null = null;
  /** Herds near each group's camp (derived, refreshed daily). */
  private readonly gameCache = new Map<number, { t: number; camp: number; herds: Herd[] }>();
  /** Most herds the land can carry. */
  private herdCap = MAX_HERDS;
  /** Season and climate of the current day (derived; reset when a power changes the world). */
  private seasonDay = -1;
  private seasonNow = 0;
  private climateNow = 0;
  /** What each group knows (derived from its members; rebuilt when knowledge changes). */
  private bandKnowCache: Map<number, number> | null = null;
  /** Per group: someone sick, mean hunger, number of members. */
  private bandStats: Map<number, { sick: boolean; hunger: number; size: number }> | null = null;

  private constructor(data: LifeData) {
    this.data = data;
    this.rng = new StateRng(data.rng);
    for (const [cell, level, at] of data.food) this.food.set(cell, { level, at });
    for (const a of data.archive) this.byId.set(a.id, a);
    for (const p of data.people) this.byId.set(p.id, p);
    for (const b of data.bands) this.bandById.set(b.id, b);
  }

  // ------------------------------------------------------------ creation, saving

  /** A new living world: six people near fresh water and herds all over the land. */
  static create(world: World, t: number): Life {
    const start = Math.floor(t / TICK) * TICK;
    const life = new Life({
      version: 5,
      t: start,
      rng: world.planet.seed ^ 0x5eed1e5,
      nextId: 1,
      people: [],
      herds: [],
      food: [],
      bands: [],
      archive: [],
      chronicle: [],
      popRecord: 0,
      structures: [],
      species: [],
      everKnown: 0,
    });
    for (const base of SPECIES_IDS) life.newSpecies(base, '', [0.5, 0.5, 0.5]);
    const rng = new Rng(world.planet.seed).fork('first-people');
    const home = Life.findHome(world);
    const band = life.newBand(-1);
    const founders: Person[] = [];
    for (let i = 0; i < 6; i++) {
      const p = life.addPerson(world, home, rng, { sex: i % 2 === 0 ? 'f' : 'm', age: [18, 30], band: band.id });
      if (p) founders.push(p);
    }
    // They already know each other a little.
    for (const p of founders) for (const q of founders) if (p !== q) life.addOp(p, q.id, Math.round(rng.range(15, 40)));
    life.electLeader(band, false);
    life.chron('founders', { n: founders.length, a: band.leader, major: 1 });
    life.spawnInitialHerds(world);
    return life;
  }

  /**
   * A living world from saved data. Snapshots leave out the append-only lists
   * (archive, chronicle); `ledgers` supplies them, usually from the current world.
   */
  static restore(data: LifeData | string, ledgers?: { archive: readonly ArchivedPerson[]; chronicle: readonly ChronicleEntry[]; history?: readonly number[][] }): Life {
    const raw = (typeof data === 'string' ? JSON.parse(data) : JSON.parse(JSON.stringify(data))) as LifeData;
    const d = Life.upgrade(raw);
    if (d.archiveCount !== undefined) {
      d.archive = (ledgers?.archive ?? d.archive).slice(0, d.archiveCount);
      delete d.archiveCount;
    }
    if (d.chronicleCount !== undefined) {
      d.chronicle = (ledgers?.chronicle ?? d.chronicle).slice(0, d.chronicleCount);
      delete d.chronicleCount;
    }
    if (d.historyCount !== undefined) {
      d.history = (ledgers?.history ?? d.history ?? []).slice(0, d.historyCount);
      delete d.historyCount;
    }
    return new Life(d);
  }

  /** Brings data from older versions (milestone 3) up to date, the same way every time. */
  private static upgrade(d: LifeData): LifeData {
    if ((d.version ?? 3) < 4) Life.upgradeTo4(d);
    if (d.version < 5) Life.upgradeTo5(d);
    return d;
  }

  /** Milestone 5: knowledge, shared food, camps and animal species. */
  private static upgradeTo5(d: LifeData): void {
    d.version = 5;
    for (const p of d.people) p.know = p.know ?? 0;
    for (const a of d.archive) a.know = a.know ?? 0;
    for (const b of d.bands) b.food = b.food ?? 0;
    d.structures = d.structures ?? [];
    d.everKnown = d.everKnown ?? 0;
    if (!Array.isArray(d.species) || d.species.length === 0) {
      d.species = [];
      const kinds = new Map<SpeciesId, number>();
      for (const base of SPECIES_IDS) {
        const rec: SpeciesRecord = { id: d.nextId++, base, prefix: '', genes: [0.5, 0.5, 0.5], born: 0 };
        d.species.push(rec);
        kinds.set(base, rec.id);
      }
      for (const h of d.herds) {
        h.genes = h.genes ?? [0.5, 0.5, 0.5];
        h.kind = h.kind ?? kinds.get(h.species)!;
      }
    }
  }

  private static upgradeTo4(d: LifeData): void {
    d.version = 4;
    d.archive = Array.isArray(d.archive) ? d.archive : [];
    d.chronicle = Array.isArray(d.chronicle) ? d.chronicle : [];
    d.popRecord = 0;
    for (const p of d.people) {
      const old = p as Partial<Person> & Person;
      if (!Array.isArray(old.traits)) old.traits = TRAITS.map((_, i) => Math.round(20 + 60 * hashUnit(p.id, i)));
      if (!Array.isArray(old.look.genes)) {
        const h = old.look.hair >= 6 ? 2 : old.look.hair;
        old.look.genes = [h, h];
        old.look.hair = h;
      }
      old.mother = old.mother ?? -1;
      old.father = old.father ?? -1;
      old.partner = old.partner ?? -1;
      old.partners = old.partners ?? [];
      old.rels = old.rels ?? [];
      old.moods = old.moods ?? [];
      old.social = old.social ?? 0.2;
      old.band = -1;
    }
    // Groups are formed on the first step, when the planet is at hand (see ensureBands).
    d.bands = [];
  }

  /** A deep copy of the full state (for saving). */
  serialize(): LifeData {
    this.sync();
    return JSON.parse(JSON.stringify(this.data)) as LifeData;
  }

  /** The state without the append-only lists, as compact text (for rewinding). */
  snapshotJson(): string {
    this.sync();
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this.data)) out[k] = k === 'archive' || k === 'chronicle' || k === 'history' ? [] : v;
    out.archiveCount = this.data.archive.length;
    out.chronicleCount = this.data.chronicle.length;
    out.historyCount = this.data.history?.length ?? 0;
    return JSON.stringify(out);
  }

  private sync(): void {
    this.data.rng = this.rng.state;
    this.data.food = [...this.food.entries()].map(([cell, e]) => [cell, e.level, e.at]);
  }

  get t(): number {
    return this.data.t;
  }

  /** @internal */
  nearLand(world: World, cell: number): number {
    return Life.nearestLand(world, cell);
  }

  /** The raw data, for the systems in other files (faith, tribes …). @internal */
  get raw(): LifeData {
    return this.data;
  }

  get people(): readonly Person[] {
    return this.data.people;
  }

  get herds(): readonly Herd[] {
    return this.data.herds;
  }

  get bands(): readonly Band[] {
    return this.data.bands;
  }

  get structures(): readonly Structure[] {
    return this.data.structures;
  }

  /** Shared food of a group. */
  bandFood(bandId: number): number {
    return this.bandById.get(bandId)?.food ?? 0;
  }

  get births(): number {
    return this.data.births ?? 0;
  }

  get deaths(): number {
    return this.data.deaths ?? 0;
  }

  get everKnown(): number {
    return this.data.everKnown;
  }

  get archive(): readonly ArchivedPerson[] {
    return this.data.archive;
  }

  get chronicle(): readonly ChronicleEntry[] {
    return this.data.chronicle;
  }

  /** A living or recently dead person. */
  person(id: number): Person | undefined {
    const x = this.byId.get(id);
    return isLiving(x) ? x : undefined;
  }

  /** Anyone who ever lived (living, recently dead or archived). */
  anyone(id: number): Someone | undefined {
    return this.byId.get(id);
  }

  herd(id: number): Herd | undefined {
    return this.data.herds.find((h) => h.id === id);
  }

  band(id: number): Band | undefined {
    return this.bandById.get(id);
  }

  population(): number {
    let n = 0;
    for (const p of this.data.people) if (p.alive) n++;
    return n;
  }

  ageOf(p: { born: number; died?: number }, t = this.data.t): number {
    return Math.max(0, ((p.died ?? t) - p.born) / YEAR);
  }

  /** Mood 0 … 100 and the reasons for it. */
  mood(p: Person): { value: number; reasons: MoodReason[] } {
    const partner = p.partner >= 0 ? this.person(p.partner) : undefined;
    let children = 0;
    for (const q of this.data.people) if (q.alive && (q.mother === p.id || q.father === p.id)) children++;
    const reasons = moodReasons(p, this.data.t, {
      partnerAlive: !!partner?.alive,
      childrenAlive: children,
      song: (this.bandKnows(p.band) & BIT.song) !== 0,
      hut: this.hutAt(p.cell, p.band),
      believer: (p.belief ?? -1) >= 0 && (p.faith ?? 0) >= 0.45,
      standing: this.civ.standing(p),
    });
    return { value: moodValue(reasons), reasons };
  }

  /** Mood without the parts that need a look at others (for frequent checks). */
  private quickMood(p: Person): number {
    let v = 50;
    if (p.hunger > 0.6) v -= 12;
    if (p.thirst > 0.6) v -= 12;
    if (p.sick > 0) v -= 15;
    if (p.social > 0.7) v -= 10;
    if (p.partner >= 0) v += 10;
    const t = this.data.t;
    for (const m of p.moods) if (m.until > t) v += m.v;
    return clamp(v, 0, 100);
  }

  opinion(p: Person, id: number): number {
    for (const r of p.rels) if (r[0] === id) return r[1];
    return 0;
  }

  isLeader(p: Person): boolean {
    return this.bandById.get(p.band)?.leader === p.id;
  }

  bandSize(bandId: number): number {
    let n = 0;
    for (const p of this.members(bandId)) if (p.alive && p.band === bandId) n++;
    return n;
  }

  /** Everyone whose mother or father this is, in order of birth. */
  childrenOf(id: number): Someone[] {
    const out: Someone[] = [];
    for (const a of this.data.archive) if (a.mother === id || a.father === id) out.push(a);
    for (const p of this.data.people) if (p.mother === id || p.father === id) out.push(p);
    return out.sort((a, b) => a.born - b.born || a.id - b.id);
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
    for (;;) {
      const k = this.stepTicks(this.data.t);
      if (this.data.t + k * TICK > T || n >= maxTicks) break;
      this.data.t += k * TICK;
      this.step(world, k);
      n++;
    }
    return n;
  }

  /** Ticks in the next step: coarse steps during a time skip, aligned to whole 2-hour blocks. */
  private stepTicks(t: number): number {
    const until = this.data.coarseUntil;
    if (until === undefined || t >= until) return 1;
    return (t / TICK) % COARSE === 0 && t + COARSE * TICK <= until ? COARSE : 1;
  }

  /** True while a time skip runs. */
  get skipping(): boolean {
    return this.data.coarseUntil !== undefined && this.data.t < this.data.coarseUntil;
  }

  /** Ends a time skip early (or after rewinding into one). */
  endSkip(): void {
    if (this.data.coarseUntil !== undefined) this.data.coarseUntil = Math.min(this.data.coarseUntil, this.data.t);
  }

  get coarseUntil(): number | undefined {
    return this.data.coarseUntil;
  }

  /** People without a group (data from older versions) join the nearest group or start one. */
  private ensureBands(world: World): void {
    if (this.bandsChecked) return;
    this.bandsChecked = true;
    this.updateHerdCap(world);
    const lost = this.data.people.filter((p) => p.alive && !this.bandById.has(p.band)).sort((a, b) => a.id - b.id);
    for (const p of lost) {
      const near = this.nearestLeader(world, p.cell, world.kmPerCell * 6);
      if (near !== undefined) p.band = this.person(near)!.band;
      else p.band = this.newBand(p.id).id;
    }
    if (lost.length) this.invalidateKnowledge();
  }

  private step(world: World, k: number): void {
    this.stepWorld = world;
    this.ensureBands(world);
    const t = this.data.t;
    const tick = Math.round(t / TICK);
    const prev = tick - k;
    /** Did a period of `every` ticks (shifted by `offset`) end in this step? */
    const crossed = (every: number, offset = 0) => Math.floor((tick + offset) / every) > Math.floor((prev + offset) / every);
    this.bandStats = null;
    this.memberCache = null;
    const people = this.data.people;
    const count = people.length; // babies born this step start next step
    for (let i = 0; i < count; i++) {
      const p = people[i];
      if (!p.alive) continue;
      this.updatePerson(p, world, t, k);
      if (p.alive && Math.floor((tick + p.id) / TICKS_PER_DAY) > Math.floor((prev + p.id) / TICKS_PER_DAY)) this.personDaily(p, world, t);
    }

    // Who is where (reusing the lists from the last step).
    const byCell = this.byCell;
    for (const list of byCell.values()) list.length = 0;
    if (byCell.size > 400) byCell.clear();
    for (const p of people) {
      if (!p.alive) continue;
      let list = byCell.get(p.cell);
      if (!list) byCell.set(p.cell, (list = []));
      list.push(p);
    }
    // Sickness spreads among people in the same place.
    for (const p of people) {
      if (!p.alive || p.sick <= 0) continue;
      for (const q of byCell.get(p.cell) ?? []) {
        if (q === p || !q.alive || q.sick > 0 || q.immune) continue;
        if (this.rng.chance(perStep(0.006, k))) this.makeSick(q);
      }
    }
    this.socialize(world, t, byCell, k);

    const herdSteps = Math.floor(tick / HERD_EVERY) - Math.floor(prev / HERD_EVERY);
    if (k > 1 && herdSteps > 0) {
      // Time skip: each herd moves every other period, twice as far (half the work).
      const parity = Math.floor(tick / HERD_EVERY) % 2;
      for (const h of this.data.herds) if (h.count > 0 && h.id % 2 === parity) this.updateHerd(h, world, t, 2 * herdSteps);
      if (this.data.herds.some((h) => h.count <= 0)) this.data.herds = this.data.herds.filter((h) => h.count > 0);
    } else {
      for (let i = 0; i < herdSteps; i++) {
        for (const h of this.data.herds) if (h.count > 0) this.updateHerd(h, world, t, 1);
        this.data.herds = this.data.herds.filter((h) => h.count > 0);
      }
    }
    if (crossed(TICKS_PER_DAY)) this.dailyWorld(world, t);
    if (crossed(360)) this.cleanFood(world, t);
  }

  // ------------------------------------------------------------ people: basics

  private addPerson(world: World, cell: number, rng: RandomSource, opts: { sex?: Sex; age?: [number, number]; band: number; know?: number }): Person | null {
    if (this.population() >= MAX_PEOPLE) return null;
    const s: Sex = opts.sex ?? (rng.chance(0.5) ? 'f' : 'm');
    const nameRng = new Rng(Math.floor(rng.next() * 0xffffffff));
    const [a0, a1] = opts.age ?? [16, 38];
    const p: Person = {
      id: this.data.nextId++,
      name: personName(nameRng, s),
      sex: s,
      born: this.data.t - rng.range(a0, a1) * YEAR,
      look: founderLook(rng, s === 'm'),
      traits: randomTraits(rng),
      mother: -1,
      father: -1,
      partner: -1,
      partners: [],
      band: opts.band,
      rels: [],
      moods: [],
      social: 0.1,
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
      know: opts.know ?? 0,
    };
    this.log(p, 'created');
    this.data.people.push(p);
    this.byId.set(p.id, p);
    return p;
  }

  /** A new group (of a people, maybe living in a village). @internal */
  createBand(leader: number, tribe?: number, home?: number): Band {
    const band = this.newBand(leader);
    if (tribe !== undefined) band.tribe = tribe;
    if (home !== undefined) band.home = home;
    return band;
  }

  /** A group nobody joined after all. @internal */
  dropBand(band: Band): void {
    this.data.bands = this.data.bands.filter((b) => b !== band);
    this.bandById.delete(band.id);
  }

  /** Someone from a counted crowd who becomes a person you can follow. @internal */
  addAdult(world: World, cell: number, band: number): Person | null {
    const tribe = this.tribes.tribeOfBand(band);
    const p = this.addPerson(world, cell, this.rng, { band, age: [16, 32], know: tribe?.lore ?? this.bandKnows(band) });
    if (p) this.invalidateKnowledge();
    return p;
  }

  /** @internal */
  chooseLeader(band: Band): void {
    this.electLeader(band, false);
  }

  /** Everyone, including the counted inhabitants of villages and towns. */
  totalPopulation(): number {
    return this.civ.totalPopulation();
  }

  private newBand(leader: number): Band {
    const band: Band = { id: this.data.nextId++, leader, founded: this.data.t, food: 0 };
    this.data.bands.push(band);
    this.bandById.set(band.id, band);
    return band;
  }

  /** @internal */
  log(p: Person, key: LogKey, extra?: { cause?: DeathCause; other?: number; n?: number }): void {
    const entry: LogEntry = { t: this.data.t, key };
    if (extra?.cause) entry.cause = extra.cause;
    if (extra?.other !== undefined && extra.other >= 0) entry.other = extra.other;
    if (extra?.n !== undefined) entry.n = extra.n;
    p.log.push(entry);
    if (p.log.length > MAX_LOG) {
      // Forget small things first, keep the first line (birth).
      let drop = p.log.findIndex((l, i) => i > 0 && !MAJOR_LOG.has(l.key));
      if (drop < 0) drop = 1;
      p.log.splice(drop, 1);
    }
  }

  /** @internal */
  chron(key: ChronicleKey, fields: Omit<ChronicleEntry, 't' | 'key'> = {}): void {
    this.data.chronicle.push({ t: this.data.t, key, ...fields });
  }

  /** @internal */
  addMood(p: Person, key: MoodKey, v: number, days: number, other?: number): void {
    const m = { key, v, until: this.data.t + days * DAY } as Person['moods'][number];
    if (other !== undefined) m.other = other;
    p.moods.push(m);
    if (p.moods.length > 10) {
      p.moods.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
      p.moods.length = 10;
    }
  }

  /** @internal */
  die(p: Person, cause: DeathCause): void {
    if (!p.alive) return;
    const age = this.ageOf(p);
    const wasLeader = this.isLeader(p);
    const partner = p.partner;
    p.alive = false;
    p.died = this.data.t;
    p.cause = cause;
    p.next = -1;
    p.path = [];
    p.action = 'idle';
    p.goal = 'none';
    p.pregnant = undefined;
    p.chat = undefined;
    p.dest = undefined;
    this.log(p, 'died', { cause });
    this.data.deaths = (this.data.deaths ?? 0) + 1;
    this.civ.onDeath(p);
    // The chronicle names everyone while the world is small, later only notable people.
    const notable = wasLeader || age >= 70 || p.log.some((l) => l.key === 'invented') || !['age', 'sickness', 'hunger', 'thirst', 'cold', 'war', 'murder'].includes(cause);
    if (notable || this.population() < SMALL_WORLD) this.chron('death', { a: p.id, n: Math.floor(age), s: cause, ...(wasLeader ? { major: 1 as const } : {}) });
    this.invalidateKnowledge();
    this.checkLostKnowledge(p.know);
    p.partner = -1;
    if (partner >= 0) {
      const q = this.person(partner);
      if (q && q.partner === p.id) q.partner = -1;
    }
    this.mourn(p, partner);
    if (wasLeader) {
      const band = this.bandById.get(p.band);
      if (band) this.electLeader(band, true);
    }
    if (this.population() === 0) this.chron('extinct', { major: 1 });
  }

  /** Family and friends grieve. */
  private mourn(dead: Person, partner: number): void {
    for (const q of this.data.people) {
      if (!q.alive || q === dead || this.ageOf(q) < 3) continue;
      let v = 0;
      let days = 0;
      let logged = true;
      if (q.id === partner) [v, days] = [-35, 30];
      else if (dead.mother === q.id || dead.father === q.id) [v, days] = [-35, 30];
      else if (q.mother === dead.id || q.father === dead.id) [v, days] = [-28, 20];
      else if (this.siblings(q, dead)) [v, days] = [-18, 14];
      else if (this.opinion(q, dead.id) >= 40) [v, days, logged] = [-10, 8, false];
      if (v === 0) continue;
      // Burial rites help the living to let go.
      if (this.bandKnows(q.band) & BIT.burial) [v, days] = [Math.round(v * 0.7), Math.max(3, Math.round(days * 0.6))];
      this.addMood(q, 'grief', v, days, dead.id);
      if (logged) this.log(q, 'grief', { other: dead.id });
    }
  }

  /** @internal */
  makeSick(p: Person): void {
    if (p.sick > 0 || p.immune || !p.alive) return;
    if (p.luck !== undefined && p.luck > this.data.t) return;
    p.sick = this.rng.range(4, 9) * DAY;
    this.log(p, 'sick');
  }

  /** @internal */
  hurt(p: Person, amount: number, cause: DeathCause): void {
    p.health -= amount;
    p.hurtBy = cause;
  }

  localHours(world: World, cell: number, t: number): number {
    const pos = world.planet.positions;
    const lon = longitudeOf(pos[cell * 3], pos[cell * 3 + 2]);
    return localSolarHours(lon, sunLongitude((t % DAY) / DAY));
  }

  /** The day's mean temperature (season and climate, not the hour): what plants and herds feel. */
  private dayTemperature(world: World, cell: number, t: number): number {
    const day = Math.floor(t / DAY);
    if (day !== this.seasonDay) {
      const t0 = day * DAY;
      this.seasonDay = day;
      this.seasonNow = seasonSignal((t0 % YEAR) / YEAR);
      this.climateNow = world.globalTemperature(t0);
    }
    const planet = world.planet;
    const hemisphere = Math.max(-1, Math.min(1, planet.positions[cell * 3 + 1] * 8));
    return planet.temperature[cell] + planet.seasonAmplitude[cell] * hemisphere * this.seasonNow + this.climateNow;
  }

  temperatureAt(world: World, cell: number, t: number): number {
    const season = seasonSignal((t % YEAR) / YEAR);
    return currentTemperature(world.planet, cell, season, this.localHours(world, cell, t)) + world.globalTemperature(t);
  }

  /** Fresh water in this place or right next to it (or rain). */
  private hasWater(world: World, cell: number, raining: boolean): boolean {
    return raining || this.waterScore(world, cell) > 0;
  }

  /** True if most of the group is close by (a leader waits for stragglers). */
  private groupTogether(p: Person, world: World): boolean {
    let all = 0;
    let near = 0;
    for (const q of this.members(p.band)) {
      if (!q.alive || q === p || q.band !== p.band) continue;
      all++;
      if (world.within(q.cell, p.cell, world.kmPerCell * 2.5)) near++;
    }
    return all === 0 || near >= all * 0.6;
  }

  // ------------------------------------------------------------ people: each step

  private updatePerson(p: Person, world: World, t: number, k: number): void {
    const dt = (TICK * k) / DAY;
    if (p.chat && t >= p.chat.until) p.chat = undefined;
    if (p.feel && t >= p.feel.until) p.feel = undefined;
    if (p.awe !== undefined && t >= p.awe) p.awe = undefined;
    if (p.luck !== undefined && t >= p.luck) p.luck = undefined;
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
    const age = this.ageOf(p, t);
    const lucky = p.luck !== undefined;

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
        this.addMood(p, 'fled', -10, 4);
      }
    }
    if (st.water > 0.2) {
      danger = true;
      if (st.water > 0.55 && this.rng.chance(perStep(lucky ? 0.05 : 0.2, k))) return this.die(p, 'flood');
      this.hurt(p, 0.08, 'flood');
      if (!(p.flags & 16)) {
        p.flags |= 16;
        this.log(p, 'fledFlood');
        this.addMood(p, 'fled', -10, 4);
      }
    }
    const sheltered = p.action === 'sleep' && this.hutAt(p.cell, p.band);
    if (st.storm > 0.6) this.hurt(p, 0.02 * st.storm * (sheltered ? 0.3 : 1), 'storm');
    if (!danger) p.flags &= ~(8 | 16);

    // Needs.
    const appetite = age < 13 ? 0.75 : 1;
    p.hunger = Math.min(1, p.hunger + 0.42 * dt * appetite);
    p.thirst = Math.min(1, p.thirst + (st.raining ? 0 : 0.55 * dt * appetite));
    if (st.raining) p.thirst = Math.max(0, p.thirst - 0.04 * k);
    p.energy = Math.max(0, Math.min(1, p.energy + (p.action === 'sleep' ? (sheltered ? 3 : 2.4) : -0.85) * dt));
    if (age >= 3) p.social = Math.min(1, p.social + 0.2 * dt);
    if (age < 3) {
      // Babies are fed by whoever looks after them.
      const carer = this.caretaker(p);
      if (carer && (carer.cell === p.cell || carer.next === p.cell)) {
        p.hunger = Math.max(0, p.hunger - 0.03 * k);
        p.thirst = Math.max(0, p.thirst - 0.04 * k);
      }
    }

    if (p.hunger >= 1) {
      this.hurt(p, 0.12 * dt, 'hunger');
      if (!(p.flags & FLAG_STARVING)) {
        p.flags |= FLAG_STARVING;
        this.log(p, 'starving');
      }
    } else if (p.hunger < 0.5) p.flags &= ~FLAG_STARVING;
    if (p.thirst >= 1) {
      this.hurt(p, 0.25 * dt, 'thirst');
      if (!(p.flags & FLAG_PARCHED)) {
        p.flags |= FLAG_PARCHED;
        this.log(p, 'parched');
      }
    } else if (p.thirst < 0.5) p.flags &= ~FLAG_PARCHED;

    // Fire, clothes and huts let people stand the cold.
    const know = this.bandKnows(p.band);
    const coldLimit = -10 - (know & BIT.fire ? 6 : 0) - (know & BIT.clothing ? 10 : 0) - (sheltered ? 6 : 0);
    const temp = this.temperatureAt(world, p.cell, t);
    if (temp < coldLimit) {
      this.hurt(p, ((coldLimit - temp) / 10) * 0.18 * dt, 'cold');
      if (!(p.flags & FLAG_FREEZING)) {
        p.flags |= FLAG_FREEZING;
        this.log(p, 'freezing');
      }
    } else if (temp > coldLimit + 5) p.flags &= ~FLAG_FREEZING;

    if (st.plague && !p.immune && p.sick <= 0 && this.rng.chance(perStep(0.03, k))) this.makeSick(p);
    if (p.sick > 0) {
      // Healing herbs make sickness milder.
      this.hurt(p, 0.11 * dt * (know & BIT.herbs ? 0.5 : 1), 'sickness');
      p.sick -= TICK * k;
      if (p.sick <= 0) {
        p.sick = 0;
        p.immune = true;
        this.log(p, 'recovered');
      }
    } else if (p.hunger < 0.6 && p.thirst < 0.6 && !danger) {
      p.health = Math.min(1, p.health + 0.2 * dt * (lucky ? 2 : 1) * (age > 60 ? 0.6 : 1));
    }
    if (p.health <= 0) return this.die(p, p.hurtBy ?? 'hunger');

    if (p.pregnant && t >= p.pregnant.due) {
      this.giveBirth(p, world, t);
      if (!p.alive) return;
    }

    // Doing things.
    if (danger && p.goal !== 'safety') {
      this.flee(p, world, t);
    } else if (p.action === 'walk' && age >= 3 && p.goal !== 'safety' && p.thirst > 0.6 && this.hasWater(world, p.cell, false)) {
      // Water right here: drink before walking on.
      this.start(p, 'drink', t, 60, true);
    } else if (p.action === 'walk') {
      const away = p.goal === 'hunt' || p.goal === 'work';
      const urgent =
        age >= 3 &&
        ((p.thirst > (away ? 0.5 : 0.7) && p.goal !== 'water') || (p.hunger > (away ? 0.6 : 0.75) && p.goal !== 'food' && p.goal !== 'water'));
      if (urgent) this.decide(p, world, t);
      else this.walk(p, world, t, age, k);
    } else if (p.action === 'gather') {
      // Stone tools and cooking make food go further; nobody takes more than they can eat.
      const worth = 9 * (lucky ? 1.5 : 1) * (know & BIT.tools ? 1.2 : 1) * (know & BIT.fire ? 1.15 : 1);
      const want = Math.min(0.012 * k, p.hunger / worth + 0.0005);
      const take = this.eat(world, p.cell, t, want);
      p.hunger = Math.max(0, p.hunger - take * worth);
      if (take < Math.min(want, 0.004 * k) * 0.99 || p.hunger <= 0.02 || t >= p.actionUntil) this.decide(p, world, t);
    } else if (p.action === 'drink') {
      p.thirst = Math.max(0, p.thirst - 0.4 * k);
      if (p.thirst <= 0 || t >= p.actionUntil) this.decide(p, world, t);
    } else if (p.action === 'sleep') {
      if (t >= p.actionUntil || (p.energy >= 1 && this.isDay(world, p.cell, t))) this.decide(p, world, t);
      else if (age >= 3 && (p.thirst > 0.85 || p.hunger > 0.9)) this.decide(p, world, t);
    } else if (t >= p.actionUntil) {
      if (WORK_ACTIONS.has(p.action)) this.finishWork(p, world, t);
      if (p.alive) this.decide(p, world, t);
    }
  }

  /** @internal */
  isDay(world: World, cell: number, t: number): boolean {
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
    const age = this.ageOf(p, t);
    if (age < 3) return this.decideBaby(p, world, t);

    // Needs come first; the group's place is the first choice, as the leader chose it well.
    const leader = this.leaderOf(p);
    const groupCell = leader && world.within(leader.cell, p.cell, world.kmPerCell * 8) ? leader.cell : -1;
    if (p.thirst > 0.5) {
      if (this.hasWater(world, p.cell, st.raining)) return this.start(p, 'drink', t, 60);
      const groupNear = groupCell >= 0 && world.within(groupCell, p.cell, world.kmPerCell * 2.5);
      if (groupNear && this.waterScore(world, groupCell) > 0 && this.goTo(p, world, (c) => c === groupCell, 4, 'water')) return;
      if (this.goTo(p, world, (c) => planet.fresh[c] !== FRESH_NONE || this.waterScore(world, c) > 0, 18, 'water')) return;
    }
    if (p.hunger > 0.45) {
      // Meat and fish the group shares, at the camp.
      const band = this.bandById.get(p.band);
      const camp = leader ? leader.cell : p.cell;
      if (band && band.food >= 1 && world.within(camp, p.cell, world.kmPerCell * 1.6)) {
        band.food -= 1;
        p.hunger = Math.max(0, p.hunger - 0.6 * (this.bandKnows(p.band) & BIT.fire ? 1.2 : 1));
        return this.start(p, 'eat', t, 60);
      }
      const here = this.foodAt(world, p.cell, t);
      if (here > 0.2) return this.start(p, 'gather', t, 180, true);
      if (groupCell >= 0 && groupCell !== p.cell && this.foodAt(world, groupCell, t) > 0.35 && this.goTo(p, world, (c) => c === groupCell, 12, 'food')) return;
      if (this.goTo(p, world, (c) => this.foodAt(world, c, t) > 0.35, 12, 'food')) return;
      // Hard times: anything edible, farther away, or whatever is left here.
      if (p.hunger > 0.65 && this.goTo(p, world, (c) => this.foodAt(world, c, t) > 0.15, 22, 'food')) return;
      if (here > 0.03) return this.start(p, 'gather', t, 120, true);
    }
    const hours = this.localHours(world, p.cell, t);
    const night = hours < 5.5 || hours >= 21;
    if ((night && p.energy < 0.85) || p.energy < 0.15 || (age < 6 && p.energy < 0.4)) {
      const wake = ((6.5 - hours + 24) % 24) * 60;
      return this.start(p, 'sleep', t, night ? Math.max(60, wake) : 240);
    }
    // On the way to a faraway new home (waiting for the others now and then).
    if (p.dest !== undefined) {
      if (world.within(p.cell, p.dest, world.kmPerCell * 1.2)) p.dest = undefined;
      else if (this.isLeader(p) && !this.groupTogether(p, world)) return this.start(p, 'rest', t, 120, true);
      else if (this.goTo(p, world, (c) => c === p.dest, 40, 'wander')) return;
      else p.dest = undefined;
    }
    // Children stay near their parents, everyone else near the group's leader.
    const guide = age < 13 ? (this.caretaker(p) ?? leader) : leader;
    const reach = age < 13 || p.feel?.kind === 'fear' ? 0.6 : 1.5;
    if (guide && guide !== p && guide.cell !== p.cell && world.kmBetween(guide.cell, p.cell) > world.kmPerCell * reach) {
      if (this.goTo(p, world, (c) => c === guide.cell, 25, age < 13 ? 'family' : 'group')) return;
    }
    // Believers in distress pray.
    if (age >= 10 && this.faith.wantsToPray(p, world)) return this.start(p, 'pray', t, 60);
    // Work for the group by day (not when thirsty or hungry: work takes people away from water).
    if (age >= 13 && p.task && p.task !== 'gather' && p.thirst < 0.35 && p.hunger < 0.45 && this.isDay(world, p.cell, t) && this.doTask(p, world, t, leader)) return;
    // A village is home: the leader stays there (the others stay near the leader).
    const home = this.civ.homeOf(p.band);
    if (home && !leader && p.dest === undefined) {
      if (!world.within(p.cell, home.cell, world.kmPerCell * 1.2) && this.goTo(p, world, (c) => c === home.cell, 20, 'group')) return;
      return this.start(p, 'rest', t, this.rng.range(60, 200), true);
    }
    // Leaders sometimes move on to a better place (always, when food runs short). With huts, they stay.
    const settled = this.hutAt(p.cell, p.band);
    const band = this.bandById.get(p.band);
    const short = settled ? p.hunger > 0.7 && (band?.food ?? 0) < 1 && this.foodAt(world, p.cell, t) < 0.1 : p.hunger > 0.5 || this.foodAt(world, p.cell, t) < 0.15;
    if (!leader && age >= 13 && (short || this.rng.chance(settled ? 0.03 : 0.25)) && this.groupTogether(p, world)) {
      const target = this.betterPlace(p, world, t, p.feel?.kind === 'courage' || short ? 7 : 4);
      if (target >= 0 && this.goTo(p, world, (c) => c === target, 8, 'wander')) return;
    }
    this.start(p, 'rest', t, this.rng.range(60, 200), true);
  }

  /** Babies stay with whoever looks after them and sleep when they do. */
  private decideBaby(p: Person, world: World, t: number): void {
    const carer = this.caretaker(p);
    if (!carer) return this.start(p, 'rest', t, 60);
    if (carer.cell !== p.cell && this.goTo(p, world, (c) => c === carer.cell, 30, 'family')) return;
    p.spot = [carer.spot[0] + 2.5, carer.spot[1] + 1.5];
    if (carer.action === 'sleep') return this.start(p, 'sleep', t, Math.max(60, carer.actionUntil - t));
    this.start(p, 'rest', t, 60);
  }

  /** @internal */
  start(p: Person, action: Person['action'], t: number, minutes: number, newSpot = false): void {
    p.action = action;
    p.actionUntil = t + Math.max(1, Math.round(minutes / TICK)) * TICK;
    if (newSpot) p.spot = [this.rng.range(-14, 14), this.rng.range(-14, 14)];
  }

  /** The group's leader, or null if this person leads (or the leader is gone). */
  /** @internal */
  leaderOf(p: Person): Person | null {
    const band = this.bandById.get(p.band);
    if (!band || band.leader === p.id || band.leader < 0) return null;
    const l = this.person(band.leader);
    return l && l.alive ? l : null;
  }

  /** Who looks after a child: a parent, or another adult of the group. */
  private caretaker(p: Person): Person | null {
    for (const id of [p.mother, p.father]) {
      const q = id >= 0 ? this.person(id) : undefined;
      if (q?.alive && q.band === p.band && this.ageOf(q) >= 13) return q;
    }
    const leader = this.leaderOf(p);
    if (leader && this.ageOf(leader) >= 13) return leader;
    for (const q of this.members(p.band)) if (q.alive && q !== p && q.band === p.band && this.ageOf(q) >= 16) return q;
    return null;
  }

  /** The best place within a few days' walk: food, fresh water and safety. −1 if here is best. */
  private betterPlace(p: Person, world: World, t: number, rings: number): number {
    const planet = world.planet;
    const score = (c: number, steps: number) => {
      const st = world.cellState(c, t);
      if (st.burning || st.water > 0.1 || st.lavaHeat > 0) return -1;
      const water = this.waterScore(world, c);
      if (water === 0) return -1; // never lead the group away from water
      // Avoid places with hard winters.
      const cold = Math.max(0, 8 - (planet.temperature[c] + world.globalTemperature(t) - planet.seasonAmplitude[c] * 0.5)) / 12;
      return this.foodAt(world, c, t) * 1.5 + water - cold - steps * 0.06 + this.rng.next() * 0.15;
    };
    const here = Math.max(0, score(p.cell, 0));
    let best = -1;
    let bestScore = here + 0.25;
    const seen = new Set([p.cell]);
    let frontier = [p.cell];
    for (let step = 1; step <= rings; step++) {
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

  /** Fresh water: a river, lake or spring here or next door, or small streams in damp land. */
  /** @internal */
  waterScore(world: World, c: number): number {
    const planet = world.planet;
    if (planet.fresh[c] !== FRESH_NONE) return 0.6;
    for (let k = planet.neighborOffsets[c]; k < planet.neighborOffsets[c + 1]; k++) {
      if (planet.fresh[planet.neighbors[k]] !== FRESH_NONE) return 0.3;
    }
    if (planet.moisture[c] >= 0.6 && planet.temperature[c] > -4 && planet.heightM[c] >= 0) return 0.15;
    return 0;
  }

  /** Breadth-first search over land to the nearest cell that matches. */
  /** @internal */
  goTo(p: Person, world: World, match: (c: number) => boolean, maxSteps: number, goal: Person['goal']): boolean {
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

  private walk(p: Person, world: World, t: number, age: number, k: number): void {
    if (p.next < 0) return this.arrive(p, world, t);
    const pace = age >= 3 && age < 9 ? 0.85 : age > 60 ? 0.8 : 1;
    const speed = WALK_KM_PER_TICK * k * pace * (p.goal === 'safety' ? 1.7 : 1) * (p.sick > 0 ? 0.6 : 1) * (p.energy < 0.1 ? 0.6 : 1) * (p.pregnant ? 0.85 : 1);
    p.progress += speed / Math.max(1, world.kmBetween(p.cell, p.next));
    // Long steps (time skip) can cross several cells.
    while (p.progress >= 1 && p.next >= 0 && p.path.length > 0) {
      const extra = (p.progress - 1) * Math.max(1, world.kmBetween(p.cell, p.next));
      p.cell = p.next;
      if (p.goal !== 'safety' && age >= 3 && p.thirst > 0.6 && this.hasWater(world, p.cell, false)) return this.start(p, 'drink', t, 60, true);
      p.next = p.path.shift()!;
      if (world.planet.heightM[p.next] < 0) {
        p.next = -1;
        break;
      }
      p.progress = extra / Math.max(1, world.kmBetween(p.cell, p.next));
    }
    if (p.progress >= 1 && p.next >= 0) {
      p.cell = p.next;
      p.progress = 0;
      p.next = p.path.shift() ?? -1;
      if (p.next >= 0 && world.planet.heightM[p.next] < 0) p.next = -1;
      // Water or food on the way: take it.
      if (p.goal !== 'safety' && age >= 3) {
        if (p.thirst > 0.6 && this.hasWater(world, p.cell, false)) return this.start(p, 'drink', t, 60, true);
        if (p.hunger > 0.6 && this.foodAt(world, p.cell, t) > 0.25) return this.start(p, 'gather', t, 180, true);
      }
      if (p.next < 0) this.arrive(p, world, t);
    }
  }

  private arrive(p: Person, world: World, t: number): void {
    const goal = p.goal;
    p.next = -1;
    p.path = [];
    if (goal === 'water' && this.hasWater(world, p.cell, false)) return this.start(p, 'drink', t, 60, true);
    if (goal === 'food' && this.foodAt(world, p.cell, t) > 0.05) return this.start(p, 'gather', t, 180, true);
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

  // ------------------------------------------------------------ people: each day

  private personDaily(p: Person, world: World, t: number): void {
    p.moods = p.moods.filter((m) => m.until > t);
    this.fadeOpinions(p, Math.floor(t / DAY));
    const age = this.ageOf(p, t);

    // Growing old, and the dangers of the first years.
    const yearly = age < 1 ? 0.03 : age < 5 ? 0.008 : age < 40 ? 0.002 : age < 50 ? 0.008 : age < 60 ? 0.03 : age < 70 ? 0.09 : age < 80 ? 0.2 : 0.4;
    // Healing herbs save many small children.
    const herbs = age < 5 && this.bandKnows(p.band) & BIT.herbs ? 0.6 : 1;
    if (this.rng.chance((yearly / DAYS_PER_YEAR) * herbs * (p.luck !== undefined ? 0.5 : 1))) {
      this.die(p, age < 55 ? 'sickness' : 'age');
      return;
    }
    // Coming of age: children take on some of their parents' views of others, and what they know.
    if (age >= 13 && age - 1 / DAYS_PER_YEAR < 13) {
      this.inheritOpinions(p);
      this.learnFromParents(p);
    }
    if (age >= 14) {
      this.tryInvent(p, world, t, age);
      p.task = this.chooseTask(p, world, age);
    }
    this.faith.personDaily(p, age);
    this.tribes.personDaily(p, world, age);
    this.civ.personDaily(p, age);

    if (p.sex === 'f' && !p.pregnant && p.partner >= 0) this.tryConceive(p, world, t, age);
    if (p.partner < 0 && age >= 17 && age <= 35 && !this.isLeader(p) && this.rng.chance(0.012)) this.seekPartner(p, world);

    // A couple that cannot stand each other any more breaks up.
    if (p.partner >= 0) {
      const q = this.person(p.partner);
      if (q?.alive && this.opinion(p, q.id) < -25 && this.opinion(q, p.id) < 10) this.separate(p, q);
    }
  }

  private fadeOpinions(p: Person, day: number): void {
    for (let i = p.rels.length - 1; i >= 0; i--) {
      const [id, v] = p.rels[i];
      if (this.isFamily(p, id)) continue;
      // Feelings fade slowly, strong ones even more slowly.
      if (day % (Math.abs(v) >= 60 ? 10 : 3) !== 0) continue;
      const nv = Math.trunc(v * 0.99);
      if (nv === 0) p.rels.splice(i, 1);
      else p.rels[i][1] = nv;
    }
  }

  private inheritOpinions(child: Person): void {
    for (const id of [child.mother, child.father]) {
      const parent = id >= 0 ? this.person(id) : undefined;
      if (!parent?.alive) continue;
      for (const [other, v] of parent.rels) {
        if (other === child.id || Math.abs(v) < 40 || this.isFamily(child, other)) continue;
        this.addOp(child, other, Math.round(v * 0.3));
      }
    }
  }

  private tryConceive(p: Person, world: World, t: number, age: number): void {
    const q = this.person(p.partner);
    if (!q?.alive || age < ADULT_AGE || age > 44) return;
    if (p.lastBirth !== undefined && t - p.lastBirth < 2 * YEAR) return;
    if (!world.within(p.cell, q.cell, world.kmPerCell * 1.6)) return;
    const fertility = age < 20 ? 0.6 : age < 30 ? 1 : age < 35 ? 0.8 : age < 40 ? 0.5 : 0.2;
    const fed = p.hunger < 0.6 && p.thirst < 0.6 ? 1 : 0.35;
    // Small groups have more children (and are not easily wiped out), crowded ones fewer.
    const size = this.bandSize(p.band);
    const group = size < 12 ? 1.5 : clamp(1.25 - size / 40, 0.15, 1);
    // In villages the group stays the same size; the counted crowd grows instead.
    if (this.civ.bandFull(p.band)) return;
    const world$ = this.bandById.get(p.band)?.home !== undefined ? 1 : clamp(1.2 - this.population() / 150, 0.06, 1);
    const mood = this.mood(p).value;
    const spirit = mood > 65 ? 1.15 : mood < 30 ? 0.7 : 1;
    const chance = 0.016 * fertility * fed * group * world$ * spirit * (p.luck !== undefined ? 1.5 : 1);
    if (this.rng.chance(chance)) p.pregnant = { father: q.id, due: t + PREGNANCY };
  }

  private giveBirth(mother: Person, world: World, t: number): void {
    const fatherId = mother.pregnant?.father ?? -1;
    mother.pregnant = undefined;
    mother.lastBirth = t;
    const father = this.person(fatherId) ?? (this.anyone(fatherId) as ArchivedPerson | undefined);
    const twins = this.rng.chance(0.015);
    const babies: Person[] = [];
    for (let i = 0; i < (twins ? 2 : 1); i++) {
      const baby = this.makeBaby(mother, father, world, t);
      if (baby) babies.push(baby);
    }
    if (babies.length === 0) return;
    this.data.births = (this.data.births ?? 0) + babies.length;
    const first = (this.data.births ?? 0) === babies.length;
    const record = first || this.population() < SMALL_WORLD || this.isLeader(mother) || (isLiving(father) && this.isLeader(father));
    if (!record) {
      // Not written down: the world has grown large.
    } else if (babies.length === 2) {
      this.chron('twins', { a: babies[0].id, b: babies[1].id, c: mother.id, ...(first ? { major: 1 as const } : {}) });
    } else {
      this.chron('birth', { a: babies[0].id, b: mother.id, c: fatherId, ...(first ? { major: 1 as const } : {}) });
    }
    for (const parent of [mother, isLiving(father) ? father : undefined]) {
      if (!parent?.alive) continue;
      if (babies.length === 2) this.log(parent, 'twins', { other: babies[0].id, n: babies[1].id });
      else this.log(parent, 'childBorn', { other: babies[0].id });
      this.addMood(parent, 'newborn', 20, 20, babies[0].id);
    }
    if (this.rng.chance(0.004)) this.die(mother, 'childbirth');
  }

  private makeBaby(mother: Person, father: Someone | undefined, world: World, t: number): Person | null {
    if (this.population() >= MAX_PEOPLE) return null;
    // Nature keeps the young of a group roughly balanced (small groups would die out otherwise).
    let girls = 0;
    let boys = 0;
    for (const q of this.members(mother.band)) {
      if (!q.alive || this.ageOf(q) >= 30) continue;
      if (q.sex === 'f') girls++;
      else boys++;
    }
    const boyChance = clamp(0.5 + (0.5 * (girls - boys)) / (girls + boys + 2), 0.25, 0.75);
    const sex: Sex = this.rng.chance(boyChance) ? 'm' : 'f';
    const dad = father ?? mother;
    const baby: Person = {
      id: this.data.nextId++,
      name: personName(new Rng(Math.floor(this.rng.next() * 0xffffffff)), sex),
      sex,
      born: t,
      look: childLook(this.rng, mother.look, dad.look, sex === 'm'),
      traits: childTraits(this.rng, mother.traits, dad.traits),
      mother: mother.id,
      father: father ? father.id : -1,
      partner: -1,
      partners: [],
      band: mother.band,
      rels: [],
      moods: [],
      social: 0,
      cell: mother.cell,
      next: -1,
      progress: 0,
      path: [],
      goal: 'none',
      action: 'rest',
      actionUntil: t + TICK,
      hunger: 0.1,
      thirst: 0.1,
      energy: 1,
      health: 1,
      sick: 0,
      immune: false,
      spot: [mother.spot[0] + 2.5, mother.spot[1] + 1.5],
      alive: true,
      log: [],
      flags: 0,
      know: 0,
    };
    this.log(baby, 'born', { other: mother.id, n: father ? father.id : undefined });
    this.data.people.push(baby);
    this.byId.set(baby.id, baby);
    // Family love from the first day.
    this.setOp(mother, baby.id, 70);
    this.setOp(baby, mother.id, 60);
    if (isLiving(father) && father.alive) {
      this.setOp(father, baby.id, 60);
      this.setOp(baby, father.id, 50);
    }
    for (const q of this.data.people) {
      if (q === baby || !q.alive || !this.siblings(q, baby)) continue;
      this.addOp(q, baby.id, 30);
      this.addOp(baby, q.id, 30);
    }
    void world;
    return baby;
  }

  // ------------------------------------------------------------ people: together

  private findRel(p: Person, id: number): [number, number] | undefined {
    for (const r of p.rels) if (r[0] === id) return r;
    return undefined;
  }

  private setOp(p: Person, id: number, v: number): void {
    const r = this.findRel(p, id);
    if (r) {
      r[1] = clamp(Math.round(v), -100, 100);
      return;
    }
    this.addOp(p, id, v);
  }

  /** @internal */
  addOpinion(p: Person, id: number, dv: number): void {
    this.addOp(p, id, dv);
  }

  private addOp(p: Person, id: number, dv: number): void {
    if (id === p.id) return;
    const r = this.findRel(p, id);
    if (r) {
      r[1] = clamp(Math.round(r[1] + dv), -100, 100);
      return;
    }
    const v = clamp(Math.round(dv), -100, 100);
    if (v === 0) return;
    if (p.rels.length >= MAX_RELS) {
      // Make room: forget the weakest feeling about someone outside the family.
      let weakest = -1;
      for (let i = 0; i < p.rels.length; i++) {
        if (this.isFamily(p, p.rels[i][0])) continue;
        if (weakest < 0 || Math.abs(p.rels[i][1]) < Math.abs(p.rels[weakest][1])) weakest = i;
      }
      if (weakest < 0 || Math.abs(p.rels[weakest][1]) > Math.abs(v)) return;
      p.rels.splice(weakest, 1);
    }
    p.rels.push([id, v]);
  }

  private siblings(a: { id: number; mother: number; father: number }, b: { id: number; mother: number; father: number }): boolean {
    if (a.id === b.id) return false;
    return (a.mother >= 0 && a.mother === b.mother) || (a.father >= 0 && a.father === b.father);
  }

  /** Partner, parents, children, brothers and sisters. */
  private isFamily(p: Person, id: number): boolean {
    if (id === p.partner || id === p.mother || id === p.father) return true;
    const o = this.byId.get(id);
    if (!o) return false;
    return o.mother === p.id || o.father === p.id || this.siblings(p, o);
  }

  /** Too closely related to become a couple: parents, children, brothers and sisters, grandparents. */
  isCloseKin(a: Someone, b: Someone): boolean {
    if (a.mother === b.id || a.father === b.id || b.mother === a.id || b.father === a.id) return true;
    if (this.siblings(a, b)) return true;
    const parents = (x: Someone) => [x.mother, x.father].filter((id) => id >= 0).map((id) => this.byId.get(id)).filter((y): y is Someone => !!y);
    for (const pa of parents(a)) if (pa.mother === b.id || pa.father === b.id) return true;
    for (const pb of parents(b)) if (pb.mother === a.id || pb.father === a.id) return true;
    return false;
  }

  /**
   * Young people with nobody to marry in their own group sometimes go to a
   * neighboring group to find a partner (as hunter-gatherers really did).
   */
  private seekPartner(p: Person, world: World): void {
    const own = this.members(p.band).some((q) => q !== p && q.alive && q.band === p.band && q.partner < 0 && this.canCourt(p, q));
    if (own) return;
    let best: Band | null = null;
    let bestKm = world.kmPerCell * 16;
    for (const b of this.data.bands) {
      if (b.id === p.band) continue;
      const l = this.person(b.leader);
      if (!l?.alive) continue;
      const km = world.kmBetween(l.cell, p.cell);
      if (km < bestKm && this.members(b.id).some((q) => q.alive && q.band === b.id && q.partner < 0 && this.canCourt(p, q))) {
        bestKm = km;
        best = b;
      }
    }
    if (!best) return;
    const leader = this.person(best.leader)!;
    this.moveToBand(p, best.id);
    p.dest = leader.cell;
    p.next = -1;
    p.path = [];
    p.action = 'idle';
    p.actionUntil = this.data.t;
    this.log(p, 'emigrated', { n: 0 });
  }

  private canCourt(p: Person, q: Person, ignorePartner = false): boolean {
    if (p.sex === q.sex || !p.alive || !q.alive) return false;
    if (!ignorePartner && (p.partner >= 0 || q.partner >= 0)) return false;
    const ap = this.ageOf(p);
    const aq = this.ageOf(q);
    if (ap < ADULT_AGE || aq < ADULT_AGE || Math.abs(ap - aq) > 20) return false;
    return !this.isCloseKin(p, q);
  }

  private grieving(p: Person): boolean {
    return p.moods.some((m) => m.key === 'grief' && m.v <= -15 && m.until > this.data.t);
  }

  private becomeCouple(a: Person, b: Person): void {
    a.partner = b.id;
    b.partner = a.id;
    // From different groups: one moves to the other's group (a leader never leaves).
    if (a.band !== b.band) {
      const [stay, go] = this.isLeader(b) || (!this.isLeader(a) && this.bandSize(b.band) > this.bandSize(a.band)) ? [b, a] : [a, b];
      if (!this.isLeader(go)) this.moveToBand(go, stay.band);
    }
    if (!a.partners.includes(b.id)) a.partners.push(b.id);
    if (!b.partners.includes(a.id)) b.partners.push(a.id);
    this.setOp(a, b.id, Math.max(70, this.opinion(a, b.id)));
    this.setOp(b, a.id, Math.max(70, this.opinion(b, a.id)));
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      this.log(x, 'partner', { other: y.id });
      this.addMood(x, 'partner', 20, 20, y.id);
    }
    this.tribes.onCouple(a, b);
    const [f, m] = a.sex === 'f' ? [a, b] : [b, a];
    this.chron('couple', { a: f.id, b: m.id });
  }

  /** Moves someone (and their young children) to another group. */
  private moveToBand(p: Person, band: number): void {
    this.invalidateKnowledge();
    const old = p.band;
    for (const q of this.data.people) {
      if (q.alive && q.band === old && (q === p || ((q.mother === p.id || q.father === p.id) && this.ageOf(q) < 13))) q.band = band;
    }
  }

  private separate(a: Person, b: Person): void {
    a.partner = -1;
    b.partner = -1;
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      this.log(x, 'separated', { other: y.id });
      this.addMood(x, 'separated', -15, 15, y.id);
    }
    this.chron('separated', { a: a.id, b: b.id });
  }

  /** People close to each other talk, play, flirt, quarrel and comfort each other. */
  private socialize(world: World, t: number, byCell: Map<number, Person[]>, k: number): void {
    const planet = world.planet;
    const free = (q: Person) => q.alive && !q.chat && q.action !== 'sleep' && q.action !== 'carried' && q.goal !== 'safety' && this.ageOf(q, t) >= 3;
    for (const p of this.data.people) {
      if (!free(p)) continue;
      const base = 0.045 * (0.6 + p.social);
      const chance = perStep(base, k);
      if (!this.rng.chance(chance)) continue;
      // Long steps: one talk stands for the several that would have happened.
      this.weight = (base * k) / chance;
      // Someone nearby, preferably family, a partner or a friend.
      let total = 0;
      const options: [Person, number][] = [];
      const consider = (list: Person[] | undefined) => {
        if (!list) return;
        for (const q of list) {
          if (q === p || !free(q)) continue;
          const w = 1 + Math.max(0, this.opinion(p, q.id)) / 25 + (q.id === p.partner ? 4 : 0);
          options.push([q, w]);
          total += w;
        }
      };
      consider(byCell.get(p.cell));
      for (let k = planet.neighborOffsets[p.cell]; k < planet.neighborOffsets[p.cell + 1]; k++) consider(byCell.get(planet.neighbors[k]));
      if (options.length === 0) continue;
      let r = this.rng.next() * total;
      let q = options[options.length - 1][0];
      for (const [cand, w] of options) {
        r -= w;
        if (r < 0) {
          q = cand;
          break;
        }
      }
      this.interact(p, q, t, k);
    }
  }

  private interact(p: Person, q: Person, t: number, k: number): void {
    const w = this.weight;
    const ap = this.ageOf(p, t);
    const aq = this.ageOf(q, t);
    const kindP = p.traits[T_KIND];
    const opPQ = this.opinion(p, q.id);
    const lucky = p.luck !== undefined;
    let kind: ChatKind = 'talk';
    if (ap < 13 && aq < 13) kind = 'play';
    else if (this.grieving(q) && kindP > 45 && this.rng.chance(0.5)) kind = 'comfort';
    else if (p.partner === q.id) kind = this.rng.chance(0.5) ? 'love' : 'talk';
    else if (this.canCourt(p, q)) {
      const compat = 20 - (TRAITS.reduce((s, _, i) => s + Math.abs(p.traits[i] - q.traits[i]), 0) / TRAITS.length) * 0.5;
      const attraction = opPQ + 10 + compat + this.rng.range(-15, 15) + (lucky ? 10 : 0);
      if (!this.grieving(p) && attraction > 5) kind = 'flirt';
    }
    if (kind !== 'play' && kind !== 'comfort') {
      const mood = this.quickMood(p);
      const quarrel =
        0.03 +
        p.traits[T_AGGRESSIVE] / 350 +
        (mood < 35 ? 0.08 : 0) +
        (opPQ < -20 ? 0.12 : 0) +
        (opPQ < -50 ? 0.1 : 0) +
        (p.feel?.kind === 'anger' ? 0.35 : 0) -
        kindP / 600 -
        (lucky ? 0.03 : 0);
      if (this.rng.chance(quarrel)) kind = 'quarrel';
    }
    const until = t + (k === 1 ? 3 : 1) * TICK * k;
    p.chat = { kind, with: q.id, until };
    q.chat = { kind, with: p.id, until };
    this.tribes.onTalk(p, q, kind === 'quarrel', w);
    if (kind !== 'quarrel') {
      this.faith.onTalk(p, q, w);
      // Talking passes knowledge on.
      if (countKnown(p.know) >= countKnown(q.know)) this.tryTeach(p, q, 0.04 * w);
      else this.tryTeach(q, p, 0.04 * w);
    }
    const warmth = (0.6 + kindP / 125) * w;
    switch (kind) {
      case 'talk':
        this.addOp(p, q.id, this.rng.range(1, 4) * warmth * (lucky ? 1.5 : 1));
        this.addOp(q, p.id, this.rng.range(1, 4) * (0.6 + q.traits[T_KIND] / 125) * w);
        p.social = Math.max(0, p.social - 0.35);
        q.social = Math.max(0, q.social - 0.35);
        break;
      case 'play':
        this.addOp(p, q.id, 3 * w);
        this.addOp(q, p.id, 3 * w);
        p.social = Math.max(0, p.social - 0.4);
        q.social = Math.max(0, q.social - 0.4);
        break;
      case 'love':
        this.addOp(p, q.id, 2 * w);
        this.addOp(q, p.id, 2 * w);
        p.social = Math.max(0, p.social - 0.4);
        q.social = Math.max(0, q.social - 0.4);
        break;
      case 'comfort':
        for (const m of q.moods) if (m.key === 'grief') m.v = Math.round(m.v * 0.8);
        this.addOp(q, p.id, 8);
        this.addOp(p, q.id, 3);
        q.social = Math.max(0, q.social - 0.4);
        break;
      case 'flirt': {
        this.addOp(p, q.id, (this.rng.range(4, 9) + (lucky ? 4 : 0)) * w);
        const back = this.canCourt(q, p) ? this.rng.range(2, 7) * (this.opinion(q, p.id) > -10 ? 1 : 0.3) * w : 0;
        this.addOp(q, p.id, back);
        p.social = Math.max(0, p.social - 0.3);
        if (this.opinion(p, q.id) >= 60 && this.opinion(q, p.id) >= 50 && this.canCourt(p, q)) this.becomeCouple(p, q);
        break;
      }
      case 'quarrel': {
        const loss = this.rng.range(4, 12);
        this.addOp(p, q.id, -loss);
        this.addOp(q, p.id, -loss * (1.2 - q.traits[T_KIND] / 200));
        this.addMood(p, 'quarrel', -6, 2, q.id);
        this.addMood(q, 'quarrel', -8, 2, p.id);
        const peaceLaw = this.politics.hasLaw(this.tribes.tribeOfBand(p.band), 'peace') ? 0.5 : 1;
        if (p.traits[T_AGGRESSIVE] > 65 && this.opinion(p, q.id) < -50 && this.rng.chance(0.08 * peaceLaw)) {
          // A rare fight: someone gets hurt.
          const loser = this.rng.chance(0.5) ? p : q;
          this.hurt(loser, 0.12, 'fight');
          this.log(p, 'fight', { other: q.id });
          this.log(q, 'fight', { other: p.id });
          this.addOp(q, p.id, -15);
          this.tribes.onFight(p, q);
          if (this.stepWorld) this.tribes.maybeMurder(p, q, this.stepWorld);
        }
        break;
      }
    }
  }

  // ------------------------------------------------------------ groups

  /** The adult best suited to lead: experienced, ambitious and brave (or called by you). */
  private electLeader(band: Band, announce: boolean): void {
    let best: Person | null = null;
    let bestScore = -Infinity;
    let oldest: Person | null = null;
    for (const p of this.data.people) {
      if (!p.alive || p.band !== band.id) continue;
      if (!oldest || p.born < oldest.born) oldest = p;
      const age = this.ageOf(p);
      if (age < ADULT_AGE) continue;
      const score =
        Math.min(age, 50) -
        Math.max(0, age - 60) * 1.5 +
        p.traits[T_AMBITIOUS] * 0.3 +
        p.traits[T_BRAVE] * 0.15 +
        p.traits[T_CLEVER] * 0.1 +
        (p.lead !== undefined && p.lead > this.data.t ? 200 : 0) +
        hashUnit(p.id, 99) * 4;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    const chosen = best ?? oldest;
    const id = chosen ? chosen.id : -1;
    if (id === band.leader) return;
    band.leader = id;
    if (chosen && announce) {
      this.log(chosen, 'leader');
      this.chron('leader', { a: chosen.id });
    }
  }

  private dailyWorld(world: World, t: number): void {
    // The dead are archived after the time in which they could be revived.
    if (this.data.people.some((p) => !p.alive && p.died !== undefined && t - p.died > REVIVE_WINDOW)) {
      const keep: Person[] = [];
      for (const p of this.data.people) {
        if (!p.alive && p.died !== undefined && t - p.died > REVIVE_WINDOW) {
          const a = this.toArchive(p);
          this.data.archive.push(a);
          this.byId.set(a.id, a);
        } else keep.push(p);
      }
      this.data.people = keep;
      // Feelings about the long dead fade from the living (family is remembered).
      for (const p of keep) {
        if (!p.alive) continue;
        p.rels = p.rels.filter(([id]) => this.isFamily(p, id) || isLiving(this.byId.get(id)));
      }
    }
    // Groups: drop empty ones, make sure each has a leader.
    const members = new Map<number, Person[]>();
    for (const p of this.data.people) {
      if (!p.alive) continue;
      let list = members.get(p.band);
      if (!list) members.set(p.band, (list = []));
      list.push(p);
    }
    this.data.bands = this.data.bands.filter((b) => {
      if (members.has(b.id)) return true;
      this.bandById.delete(b.id);
      return false;
    });
    for (const band of this.data.bands) {
      const leader = this.person(band.leader);
      if (!leader?.alive || leader.band !== band.id) this.electLeader(band, true);
      // Crowded groups split: a young family moves away to find a new home.
      const list = members.get(band.id) ?? [];
      if (list.length >= 26 && this.rng.chance(0.04)) {
        let mover: Person | null = null;
        let moverScore = -Infinity;
        for (const p of list) {
          const age = this.ageOf(p);
          if (p.id === band.leader || p.partner < 0 || age < 17 || age > 40) continue;
          const s = p.traits[T_BRAVE] + p.traits[T_CURIOUS] + this.rng.next() * 30;
          if (s > moverScore) {
            moverScore = s;
            mover = p;
          }
        }
        if (mover) this.emigrate(mover, world, t);
      }
    }
    // Milestones of the population.
    const pop = this.totalPopulation();
    for (const mark of POPULATION_MARKS) {
      if (pop >= mark && this.data.popRecord < mark) {
        this.data.popRecord = mark;
        this.chron('population', { n: mark, major: 1 });
      }
    }
    this.dailyCamps(t, members);
    this.dailySpecies(world, t);
    this.faith.bandsDaily(world, t);
    this.tribes.daily(world, t);
    this.civ.daily(world, t);
    this.politics.daily();
    if (Math.floor(t / DAY) % DAYS_PER_YEAR === 13) this.politics.yearly();
  }

  // ------------------------------------------------------------ knowledge

  /** What a group knows: everything any living member knows. */
  bandKnows(bandId: number): number {
    if (!this.bandKnowCache) {
      const cache = new Map<number, number>();
      for (const p of this.data.people) if (p.alive) cache.set(p.band, (cache.get(p.band) ?? 0) | p.know);
      this.bandKnowCache = cache;
    }
    return this.bandKnowCache.get(bandId) ?? 0;
  }

  /** Everything known by anyone alive. */
  worldKnows(): number {
    let m = 0;
    for (const p of this.data.people) if (p.alive) m |= p.know;
    return m;
  }

  /** @internal */
  invalidateKnowledge(): void {
    this.bandKnowCache = null;
    this.memberCache = null;
    this.bandStats = null;
  }

  /** The living members of a group (rebuilt each step). */
  /** @internal */
  members(bandId: number): Person[] {
    if (!this.memberCache) {
      const map = new Map<number, Person[]>();
      for (const p of this.data.people) {
        if (!p.alive) continue;
        let list = map.get(p.band);
        if (!list) map.set(p.band, (list = []));
        list.push(p);
      }
      this.memberCache = map;
    }
    return this.memberCache.get(bandId) ?? [];
  }

  /** @internal */
  stats(bandId: number): { sick: boolean; hunger: number; size: number } {
    if (!this.bandStats) {
      const map = new Map<number, { sick: boolean; hunger: number; size: number }>();
      for (const p of this.data.people) {
        if (!p.alive) continue;
        let s = map.get(p.band);
        if (!s) map.set(p.band, (s = { sick: false, hunger: 0, size: 0 }));
        s.size++;
        s.hunger += p.hunger;
        if (p.sick > 0) s.sick = true;
      }
      for (const s of map.values()) s.hunger /= Math.max(1, s.size);
      this.bandStats = map;
    }
    return this.bandStats.get(bandId) ?? { sick: false, hunger: 0, size: 0 };
  }

  /** When the last one who knew something dies, the knowledge is lost. */
  private checkLostKnowledge(mask: number): void {
    if (!mask) return;
    let still = this.worldKnows();
    for (const tr of this.tribes.living()) still |= tr.lore ?? 0;
    for (const id of INVENTION_IDS) {
      if (mask & BIT[id] && !(still & BIT[id])) this.chron('lost', { s: id, major: 1 });
    }
  }

  /** @internal */
  learn(p: Person, id: InventionId): void {
    p.know |= BIT[id];
    this.invalidateKnowledge();
  }

  private learnFromParents(child: Person): void {
    for (const pid of [child.mother, child.father]) {
      const parent = pid >= 0 ? this.person(pid) : undefined;
      if (!parent?.alive) continue;
      for (const id of INVENTION_IDS) {
        if (parent.know & BIT[id] && !(child.know & BIT[id]) && this.rng.chance(0.7)) this.learn(child, id);
      }
    }
  }

  /** Passes one piece of knowledge from teacher to learner (if the learner is ready for it). */
  private tryTeach(teacher: Person, learner: Person, base: number): boolean {
    const open = teacher.know & ~learner.know;
    if (!open || this.ageOf(learner) < 4) return false;
    const ready = INVENTION_IDS.filter((id) => open & BIT[id] && INVENTIONS[id].needs.every((n) => learner.know & BIT[n]));
    if (ready.length === 0) return false;
    const id = ready[this.rng.int(0, ready.length - 1)];
    const song = this.bandKnows(teacher.band) & BIT.song ? 2 : 1;
    const whispered = teacher.teacher !== undefined && teacher.teacher > this.data.t ? 4 : 1;
    const young = this.ageOf(learner) < 20 ? 1.5 : 1;
    const mind = 0.5 + learner.traits[T_CLEVER] / 100;
    if (!this.rng.chance(Math.min(0.9, base * song * whispered * young * mind))) return false;
    this.learn(learner, id);
    this.log(learner, 'learned', { other: teacher.id, n: INVENTION_IDS.indexOf(id) });
    return true;
  }

  private circumstances(p: Person, world: World, t: number): Circumstances {
    const planet = world.planet;
    let stone = stony(planet.biome[p.cell]);
    let water = planet.fresh[p.cell] !== FRESH_NONE;
    let flames = false;
    for (let k = planet.neighborOffsets[p.cell]; k < planet.neighborOffsets[p.cell + 1]; k++) {
      const n = planet.neighbors[k];
      if (stony(planet.biome[n])) stone = true;
      if (planet.fresh[n] !== FRESH_NONE || planet.heightM[n] < 0) water = true;
      const st = world.cellState(n, t);
      if (st.burning || st.burnt) flames = true;
    }
    const here = world.cellState(p.cell, t);
    const stats = this.stats(p.band);
    return {
      stone,
      water,
      forest: foresty(planet.biome[p.cell]),
      flames: flames || here.burning || here.burnt,
      temperature: this.temperatureAt(world, p.cell, t),
      sickness: stats.sick,
      hunger: stats.hunger,
      weather: here.raining || here.storm > 0.3,
      mourning: p.moods.some((m) => m.key === 'grief' && m.until > t),
    };
  }

  /** Once a day an adult may have an idea: need, opportunity, the person and chance. */
  private tryInvent(p: Person, world: World, t: number, age: number): void {
    const groupKnows = this.bandKnows(p.band);
    const options = nextSteps(p.know).filter((id) => !(groupKnows & BIT[id]));
    if (options.length === 0) return;
    const mind = 0.4 + (p.traits[T_CLEVER] + p.traits[T_CURIOUS]) / 125;
    const experience = age >= 20 && age <= 55 ? 1.2 : 1;
    // A group has ideas faster than one person, but not in proportion to its size.
    const crowd = 1 / Math.sqrt(Math.max(1, this.stats(p.band).size * 0.6));
    const tinker = p.task === 'tinker' ? 2.5 : 1;
    const luck = p.luck !== undefined ? 2 : 1;
    const c = this.circumstances(p, world, t);
    for (const id of options) {
      const chance = (INVENTIONS[id].rate / DAYS_PER_YEAR) * circumstanceFactor(id, c) * mind * experience * tinker * luck * crowd;
      if (this.rng.chance(chance)) {
        this.invent(p, id);
        return;
      }
    }
  }

  private invent(p: Person, id: InventionId): void {
    const again = (this.data.everKnown & BIT[id]) !== 0;
    this.learn(p, id);
    this.data.everKnown |= BIT[id];
    this.log(p, 'invented', { n: INVENTION_IDS.indexOf(id) });
    this.addMood(p, 'invented', 15, 30);
    this.chron('invention', { a: p.id, s: id, ...(again ? { n: 1 } : {}), major: 1 });
  }

  // ------------------------------------------------------------ work

  /** Need of the group × talent × character, with some chance. */
  private chooseTask(p: Person, world: World, age: number): Task {
    const tr = p.traits;
    const know = p.know;
    const group = this.bandKnows(p.band);
    const band = this.bandById.get(p.band);
    const stats = this.stats(p.band);
    const hungry = band ? band.food < stats.size * 0.6 : false;
    const leader = this.leaderOf(p) ?? p;
    const fit = age >= 16 && age <= 50 ? 1 : 0.3;
    const scores: [Task, number][] = [['gather', 1]];
    if (know & (BIT.spear | BIT.bow)) scores.push(['hunt', (hungry ? 1.6 : 0.5) * (0.5 + tr[T_BRAVE] / 100) * fit]);
    if (know & BIT.fishing && this.waterScore(world, leader.cell) > 0) scores.push(['fish', (hungry ? 1.5 : 0.5) * (0.5 + tr[T_DILIGENT] / 100)]);
    if (group & BIT.shelter && this.hutsWanted(p.band, leader.cell) > 0) scores.push(['build', 1.7 * (0.5 + tr[T_DILIGENT] / 100) * fit]);
    if (group & BIT.herbs && stats.sick) scores.push(['heal', 2 * (0.4 + tr[T_KIND] / 100)]);
    const teacher = p.teacher !== undefined && p.teacher > this.data.t;
    if (know && (teacher || this.someoneToTeach(p))) scores.push(['teach', (teacher ? 4 : 0.7) * (0.4 + tr[T_KIND] / 100 + tr[T_CLEVER] / 200)]);
    if (tr[T_CURIOUS] > 55) scores.push(['tinker', (tr[T_CURIOUS] / 100) * 0.8]);
    if (p.shaman) scores.push(['rite', 1.3]);
    if (band?.home !== undefined && this.civ.bandKnows(p.band, 'farming')) scores.push(['farm', 2.2 * (0.5 + tr[T_DILIGENT] / 100) * fit]);
    if (group & BIT.fire && !this.members(p.band).some((q) => q !== p && q.alive && q.band === p.band && q.task === 'fire')) {
      scores.push(['fire', age > 55 ? 1.5 : 0.7]);
    }
    let best: Task = 'gather';
    let bestScore = -Infinity;
    for (const [task, score] of scores) {
      const v = score * (0.7 + this.rng.next() * 0.6);
      if (v > bestScore) {
        bestScore = v;
        best = task;
      }
    }
    return best;
  }

  private someoneToTeach(p: Person): boolean {
    for (const q of this.members(p.band)) {
      if (!q.alive || q === p || q.band !== p.band) continue;
      const age = this.ageOf(q);
      if (age >= 4 && age < 25 && p.know & ~q.know) return true;
    }
    return false;
  }

  /** Starts the person's work (or walks there). False if there is nothing to do now. */
  private doTask(p: Person, world: World, t: number, leader: Person | null): boolean {
    const camp = leader ? leader.cell : p.cell;
    const near = (cell: number, cells: number) => world.within(cell, p.cell, world.kmPerCell * cells);
    switch (p.task) {
      case 'hunt': {
        let prey: Herd | undefined;
        let best = world.kmPerCell * 3;
        for (const h of this.gameNear(p.band, camp, world, t)) {
          if (h.count <= 0 || SPECIES[h.species].predator || !world.within(h.cell, camp, best)) continue;
          const km = world.kmBetween(h.cell, camp);
          if (km < best) {
            best = km;
            prey = h;
          }
        }
        if (!prey) return false;
        p.aim = prey.id;
        if (near(prey.cell, 1.2)) {
          this.start(p, 'hunt', t, 120, true);
          return true;
        }
        const target = prey.cell;
        return this.goTo(p, world, (c) => c === target, 4, 'hunt');
      }
      case 'fish':
        if (this.waterScore(world, p.cell) > 0 || this.coastal(world, p.cell)) {
          this.start(p, 'fish', t, 180, true);
          return true;
        }
        return this.goTo(p, world, (c) => this.waterScore(world, c) > 0 && near(c, 3), 4, 'work');
      case 'build':
        if (this.hutsWanted(p.band, camp) <= 0) return false;
        if (p.cell === camp) {
          this.start(p, 'build', t, 180, true);
          return true;
        }
        return this.goTo(p, world, (c) => c === camp, 10, 'work');
      case 'heal': {
        const sick = this.members(p.band).find((q) => q.alive && q !== p && q.band === p.band && q.sick > 0 && near(q.cell, 3));
        if (!sick) return false;
        p.aim = sick.id;
        if (sick.cell === p.cell) {
          this.start(p, 'heal', t, 120);
          return true;
        }
        const target = sick.cell;
        return this.goTo(p, world, (c) => c === target, 5, 'work');
      }
      case 'teach': {
        const pupil = this.members(p.band).find((q) => q.alive && q !== p && q.band === p.band && this.ageOf(q) >= 4 && this.ageOf(q) < 25 && p.know & ~q.know && near(q.cell, 2));
        if (!pupil) return false;
        p.aim = pupil.id;
        if (pupil.cell === p.cell) {
          this.start(p, 'teach', t, 90);
          p.chat = { kind: 'talk', with: pupil.id, until: t + 90 };
          return true;
        }
        const target = pupil.cell;
        return this.goTo(p, world, (c) => c === target, 4, 'work');
      }
      case 'fire':
        if (p.cell !== camp) return this.goTo(p, world, (c) => c === camp, 10, 'work');
        this.start(p, 'fire', t, 240);
        return true;
      case 'tinker':
        this.start(p, 'tinker', t, 180, true);
        return true;
      case 'farm': {
        const home = this.civ.homeOf(p.band);
        if (!home) return false;
        if (!world.within(p.cell, home.cell, world.kmPerCell * 1.2)) return this.goTo(p, world, (c) => c === home.cell, 12, 'work');
        this.start(p, 'farm', t, 240, true);
        return true;
      }
      case 'rite': {
        // At the holy place if it is near, otherwise at the camp.
        const rel = p.belief !== undefined && p.belief >= 0 ? this.faith.religion(p.belief) : undefined;
        const place = rel && world.within(rel.holy, p.cell, world.kmPerCell * 4) ? rel.holy : camp;
        if (p.cell !== place) return this.goTo(p, world, (c) => c === place, 6, 'work');
        this.start(p, 'pray', t, 120);
        return true;
      }
      default:
        return false;
    }
  }

  /** The result of a piece of work. */
  private finishWork(p: Person, world: World, t: number): void {
    const band = this.bandById.get(p.band);
    const know = this.bandKnows(p.band);
    switch (p.action) {
      case 'hunt': {
        const prey = p.aim !== undefined ? this.herd(p.aim) : undefined;
        if (!prey || prey.count <= 0 || !world.within(prey.cell, p.cell, world.kmPerCell * 1.5)) return;
        prey.fear = t;
        const speed = prey.genes[2];
        const chance = 0.25 * (p.know & BIT.bow ? 1.6 : 1) * (0.6 + p.traits[T_BRAVE] / 100) * (prey.species === 'mammoth' ? 0.6 : 1) * (1.3 - speed * 0.6);
        if (this.rng.chance(chance)) {
          prey.count -= 1;
          const meat = MEAT[prey.species] * (0.6 + 0.8 * prey.genes[0]);
          if (band) band.food += meat * (know & BIT.fire ? 1.2 : 1);
          p.hunger = Math.max(0, p.hunger - 0.4);
          this.log(p, 'hunted', { n: SPECIES_IDS.indexOf(prey.species) });
        } else if ((prey.species === 'mammoth' || prey.species === 'bison') && this.rng.chance(0.04)) {
          this.hurt(p, 0.3, 'hunt');
        }
        return;
      }
      case 'fish':
        if (band && this.rng.chance(0.6)) band.food += 1 + p.traits[T_DILIGENT] / 100;
        return;
      case 'build': {
        const camp = this.leaderOf(p)?.cell ?? p.cell;
        let hut = this.data.structures.find((s) => s.kind === 'hut' && s.band === p.band && s.cell === camp && s.built < 1);
        if (!hut && this.hutsWanted(p.band, camp) > 0) hut = this.addStructure('hut', camp, p.band, 0);
        if (hut) {
          hut.built = Math.min(1, hut.built + 0.35 * (0.6 + p.traits[T_DILIGENT] / 100));
          hut.used = t;
        }
        return;
      }
      case 'heal': {
        const sick = p.aim !== undefined ? this.person(p.aim) : undefined;
        if (sick?.alive && sick.cell === p.cell) {
          sick.sick = Math.max(0, sick.sick - 1.5 * DAY);
          sick.health = Math.min(1, sick.health + 0.1);
          this.addOp(sick, p.id, 6);
        }
        return;
      }
      case 'teach': {
        const pupil = p.aim !== undefined ? this.person(p.aim) : undefined;
        if (pupil?.alive && pupil.cell === p.cell) this.tryTeach(p, pupil, 0.35);
        return;
      }
      case 'farm': {
        if (!band) return;
        const season = Math.floor(((t % YEAR) / YEAR) * 4);
        const crop = season === 3 ? 0.35 : season === 0 ? 0.8 : 1.2;
        const k = (id: Parameters<CivSystem['bandKnows']>[1], f: number) => (this.civ.bandKnows(p.band, id) ? f : 1);
        band.food += crop * (0.8 + p.traits[T_DILIGENT] / 125) * k('herding', 1.25) * k('wheel', 1.15);
        return;
      }
      case 'pray':
        if (p.shaman) this.faith.rite(p);
        else this.log(p, 'prayed');
        return;
      case 'fire': {
        const fire = this.data.structures.find((s) => s.kind === 'fire' && s.band === p.band && s.cell === p.cell);
        if (fire) fire.used = t;
        else if (know & BIT.fire) this.addStructure('fire', p.cell, p.band, 1);
        return;
      }
      default:
        return;
    }
  }

  /** Herds within reach of a camp (looked up once per step and group). */
  private gameNear(band: number, camp: number, world: World, t: number): Herd[] {
    const cached = this.gameCache.get(band);
    if (cached && cached.t === t && cached.camp === camp) return cached.herds.filter((h) => h.count > 0);
    const herds = this.data.herds.filter((h) => h.count > 0 && !SPECIES[h.species].predator && world.within(h.cell, camp, world.kmPerCell * 4));
    this.gameCache.set(band, { t, camp, herds });
    return herds;
  }

  private coastal(world: World, cell: number): boolean {
    const planet = world.planet;
    for (let k = planet.neighborOffsets[cell]; k < planet.neighborOffsets[cell + 1]; k++) if (planet.heightM[planet.neighbors[k]] < 0) return true;
    return false;
  }

  // ------------------------------------------------------------ camps

  /** @internal */
  addStructure(kind: Structure['kind'], cell: number, band: number, built: number): Structure {
    const st: Structure = {
      id: this.data.nextId++,
      kind,
      cell,
      spot: kind === 'fire' ? [this.rng.range(-3, 3), this.rng.range(-3, 3)] : [this.rng.range(-11, 11), this.rng.range(-11, 11)],
      band,
      built,
      used: this.data.t,
    };
    this.data.structures.push(st);
    return st;
  }

  /** A finished hut of this group in this place. */
  /** @internal */
  hutAt(cell: number, band: number): boolean {
    for (const s of this.data.structures) if (s.kind === 'hut' && s.cell === cell && s.band === band && s.built >= 1) return true;
    return false;
  }

  /** How many more huts the group wants at its camp (one per three people). */
  private hutsWanted(band: number, camp: number): number {
    if (!(this.bandKnows(band) & BIT.shelter)) return 0;
    let have = 0;
    for (const s of this.data.structures) if (s.kind === 'hut' && s.cell === camp && s.band === band) have++;
    return Math.ceil(this.stats(band).size / 3) - have;
  }

  /** Fireplaces at camps, shared food that spoils, abandoned places that fall apart. */
  private dailyCamps(t: number, members: Map<number, Person[]>): void {
    for (const band of this.data.bands) {
      const know = this.bandKnows(band.id);
      band.food *= know & BIT.pottery ? 0.96 : 0.88;
      if (band.food < 0.05) band.food = 0;
      const leader = this.person(band.leader);
      if (!leader?.alive || leader.action === 'walk') continue;
      const camp = leader.cell;
      if (know & BIT.fire && !this.data.structures.some((s) => s.kind === 'fire' && s.cell === camp)) this.addStructure('fire', camp, band.id, 1);
      for (const s of this.data.structures) if (s.cell === camp && s.band === band.id) s.used = t;
      // Huts nearby that another group left are taken over.
      for (const s of this.data.structures) if (s.cell === camp && s.band !== band.id && !members.has(s.band)) s.band = band.id;
    }
    const keep = this.data.structures.filter((s) => s.kind === 'shrine' || t - s.used < (s.kind === 'fire' ? 1 : 4) * YEAR);
    if (keep.length > MAX_STRUCTURES) keep.splice(0, keep.length - MAX_STRUCTURES);
    this.data.structures = keep;
  }

  private toArchive(p: Person): ArchivedPerson {
    return {
      id: p.id,
      name: p.name,
      sex: p.sex,
      born: p.born,
      died: p.died ?? this.data.t,
      cause: p.cause ?? 'age',
      mother: p.mother,
      father: p.father,
      partners: [...p.partners],
      look: { ...p.look, genes: [p.look.genes[0], p.look.genes[1]] },
      traits: [...p.traits],
      band: p.band,
      cell: p.cell,
      spot: [p.spot[0], p.spot[1]],
      log: p.log.filter((l) => MAJOR_LOG.has(l.key)).slice(-12),
      know: p.know,
      ...((p.belief ?? -1) >= 0 ? { belief: p.belief } : {}),
      ...(p.shaman ? { shaman: true } : {}),
    };
  }

  /**
   * Someone leaves with their partner and young children to find a new home
   * far away, and founds a new group. A leader takes the whole group along.
   */
  /** @internal */
  emigrate(p: Person, world: World, t: number): boolean {
    const dest = this.farPlace(p, world, t);
    if (dest < 0) return false;
    const band = this.bandById.get(p.band);
    if (band && band.leader === p.id) {
      p.dest = dest;
      const n = this.bandSize(p.band) - 1;
      this.log(p, 'emigrated', { n });
      this.chron('moved', { a: p.id, n: n + 1, major: 1 });
      return true;
    }
    const movers = [p];
    const partner = p.partner >= 0 ? this.person(p.partner) : undefined;
    if (partner?.alive && partner.band === p.band) movers.push(partner);
    for (const q of this.data.people) {
      if (!q.alive || q.band !== p.band || movers.includes(q) || this.ageOf(q) >= 13) continue;
      if (q.mother === p.id || q.father === p.id || (partner && (q.mother === partner.id || q.father === partner.id))) movers.push(q);
    }
    const newBand = this.newBand(p.id);
    if (band?.tribe !== undefined) newBand.tribe = band.tribe;
    this.invalidateKnowledge();
    for (const q of movers) {
      q.band = newBand.id;
      q.next = -1;
      q.path = [];
      q.action = 'idle';
      q.actionUntil = t;
    }
    p.dest = dest;
    this.log(p, 'emigrated', { n: movers.length - 1 });
    if (partner && movers.includes(partner)) this.log(partner, 'emigrated', { n: movers.length - 1 });
    this.chron('emigrate', { a: p.id, n: movers.length, major: 1 });
    return true;
  }

  /** Someone is sent away alone and must find a new home. @internal */
  exile(p: Person, world: World): boolean {
    const dest = this.farPlace(p, world, this.data.t);
    if (dest < 0 || this.isLeader(p)) return false;
    const old = this.bandById.get(p.band);
    const band = this.newBand(p.id);
    if (old?.tribe !== undefined) band.tribe = old.tribe;
    this.invalidateKnowledge();
    p.band = band.id;
    p.next = -1;
    p.path = [];
    p.action = 'idle';
    p.actionUntil = this.data.t;
    p.dest = dest;
    if (p.partner >= 0) {
      const q = this.person(p.partner);
      if (q?.alive) this.separate(p, q);
    }
    return true;
  }

  /** A good place 7–16 cells away, not too close to another group. */
  private farPlace(p: Person, world: World, t: number): number {
    const planet = world.planet;
    const others: number[] = [];
    for (const b of this.data.bands) {
      if (b.id === p.band) continue;
      const l = this.person(b.leader);
      if (l?.alive) others.push(l.cell);
    }
    let best = -1;
    let bestScore = -Infinity;
    const seen = new Set([p.cell]);
    let frontier = [p.cell];
    for (let step = 1; step <= 16; step++) {
      const next: number[] = [];
      for (const c of frontier) {
        for (let k = planet.neighborOffsets[c]; k < planet.neighborOffsets[c + 1]; k++) {
          const n = planet.neighbors[k];
          if (seen.has(n) || planet.heightM[n] < 0) continue;
          seen.add(n);
          next.push(n);
          if (step < 7) continue;
          const water = this.waterScore(world, n);
          const food = this.capacity(world, n, t);
          if (water === 0 || food < 0.3) continue;
          if (others.some((o) => world.within(o, n, world.kmPerCell * 5))) continue;
          const s = food * 1.5 + water + this.rng.next() * 0.3;
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

  // ------------------------------------------------------------ food

  /** How much food a cell can hold right now (season, fire damage, blessings). */
  capacity(world: World, cell: number, t: number): number {
    const planet = world.planet;
    if (planet.heightM[cell] < 0) return 0;
    let cap = BIOME_FOOD[planet.biome[cell] as Biome] ?? 0;
    if (cap <= 0) return 0;
    const st = world.cellState(cell, t);
    cap *= 0.15 + 0.85 * st.veg;
    const temp = this.dayTemperature(world, cell, t);
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

  /** The land carries about one herd per twenty land cells. */
  private updateHerdCap(world: World): void {
    let land = 0;
    for (let c = 0; c < world.planet.cellCount; c++) if (world.planet.heightM[c] >= 0) land++;
    this.herdCap = clamp(Math.round(land / 20), 60, MAX_HERDS);
  }

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

  private addHerd(species: SpeciesId, cell: number, count: number, genes?: [number, number, number], kind?: number): Herd | null {
    if (this.data.herds.length >= MAX_HERDS) return null;
    const g: [number, number, number] = genes ? [genes[0], genes[1], genes[2]] : [0.5 + this.rng.range(-0.03, 0.03), 0.5 + this.rng.range(-0.03, 0.03), 0.5 + this.rng.range(-0.03, 0.03)];
    const h: Herd = {
      id: this.data.nextId++,
      species,
      count,
      cell,
      next: -1,
      progress: 0,
      hunger: 0.2,
      bornYear: dateFromMinutes(this.data.t).year,
      prey: -1,
      genes: g,
      kind: kind ?? this.baseKind(species),
    };
    this.data.herds.push(h);
    return h;
  }

  // ------------------------------------------------------------ species and evolution

  get species(): readonly SpeciesRecord[] {
    return this.data.species;
  }

  speciesRecord(id: number): SpeciesRecord | undefined {
    return this.data.species.find((r) => r.id === id);
  }

  private newSpecies(base: SpeciesId, prefix: string, genes: [number, number, number], parent?: number): SpeciesRecord {
    const rec: SpeciesRecord = { id: this.data.nextId++, base, prefix, genes: [genes[0], genes[1], genes[2]], born: this.data.t };
    if (parent !== undefined) rec.parent = parent;
    this.data.species.push(rec);
    return rec;
  }

  /** The original species of a kind (brought back if it had died out). */
  private baseKind(base: SpeciesId): number {
    let rec = this.data.species.find((r) => r.base === base && r.prefix === '');
    if (!rec) rec = this.newSpecies(base, '', [0.5, 0.5, 0.5]);
    rec.extinct = undefined;
    return rec.id;
  }

  /** Thick fur lets animals stand more cold (and less heat). */
  private feltTemperature(h: Herd, temperature: number): number {
    return temperature + (h.genes[1] - 0.5) * 16;
  }

  /** Young are like their parents with small changes; what suits the place survives better. */
  private evolve(h: Herd, world: World, t: number): void {
    const temp = world.planet.temperature[h.cell] + world.globalTemperature(t);
    const hunted = h.fear !== undefined && t - h.fear < 2 * YEAR;
    const opt: [number, number, number] = [
      clamp(0.5 + (8 - temp) / 50 - (h.hunger > 0.5 ? 0.15 : 0), 0.05, 0.95),
      clamp(0.5 + (8 - temp) / 30, 0.02, 0.98),
      SPECIES[h.species].predator ? 0.6 : hunted ? 0.78 : 0.45,
    ];
    for (let i = 0; i < 3; i++) h.genes[i] = clamp(h.genes[i] + (opt[i] - h.genes[i]) * SELECTION + this.rng.range(-0.015, 0.015), 0, 1);
  }

  /** Every five years: new species where herds have changed a lot, and species that died out. */
  private dailySpecies(world: World, t: number): void {
    const year = Math.floor(t / YEAR);
    if (Math.floor((t - DAY) / YEAR) === year || year % 5 !== 0) return;
    const byKind = new Map<number, Herd[]>();
    for (const h of this.data.herds) {
      if (h.count <= 0) continue;
      let list = byKind.get(h.kind);
      if (!list) byKind.set(h.kind, (list = []));
      list.push(h);
    }
    const alive = this.data.species.filter((r) => r.extinct === undefined).length;
    for (const rec of [...this.data.species]) {
      if (rec.extinct !== undefined) continue;
      const herds = byKind.get(rec.id) ?? [];
      if (herds.length === 0) {
        rec.extinct = t;
        this.chron('speciesGone', { n: rec.id, major: 1 });
        continue;
      }
      if (alive >= 40) continue;
      const far = herds.find((h) => geneDistance(h.genes, rec.genes) > SPECIATION);
      if (!far) continue;
      const group = herds.filter((h) => geneDistance(h.genes, far.genes) < 0.12);
      const mean: [number, number, number] = [0, 0, 0];
      for (const h of group) for (let i = 0; i < 3; i++) mean[i] += h.genes[i] / group.length;
      const prefix = genePrefix(mean, rec.genes);
      const same = this.data.species.find((r) => r.extinct === undefined && r.base === rec.base && r.prefix === prefix);
      const target = same ?? this.newSpecies(rec.base, prefix, mean, rec.id);
      for (const h of group) h.kind = target.id;
      if (!same) {
        const near = this.nearestLeader(world, far.cell, 1500);
        this.chron('species', { n: target.id, ...(near !== undefined ? { a: near } : {}), major: 1 });
      }
    }
  }

  /** One herd period (2 hours), or m of them at once during a time skip. */
  private updateHerd(h: Herd, world: World, t: number, m: number): void {
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
    if (st.plague && this.rng.chance(perStep(0.25, m))) h.count -= 1;
    if (st.storm > 0.7 && this.rng.chance(perStep(0.2, m))) h.count -= 1;
    if (h.count <= 0) return;

    // Young are born once each spring when the herd is well fed.
    const date = dateFromMinutes(t);
    if (date.season === 0 && date.dayOfSeason >= 3 && h.bornYear !== date.year && h.hunger < 0.5) {
      // Fewer young when the land is full of animals.
      const room = clamp(1 - this.data.herds.length / this.herdCap, 0, 1);
      const young = h.count * (sp.predator ? 0.35 : 0.3) * (0.3 + 0.7 * room) * (1 - h.hunger);
      h.count += Math.floor(young) + (this.rng.chance(young - Math.floor(young)) ? 1 : 0);
      h.bornYear = date.year;
      this.evolve(h, world, t);
    }

    // Eating.
    if (sp.predator) {
      h.hunger = Math.min(1, h.hunger + 0.022 * m);
    } else {
      // Herds live mostly on grass; only about a third of what they eat is food people want too.
      const need = h.count * sp.appetite * (0.6 + 0.8 * h.genes[0]) * m;
      const got = this.eat(world, h.cell, t, need * 0.35) / 0.35;
      h.hunger = Math.max(0, Math.min(1, h.hunger + (0.05 - 0.14 * (got / Math.max(1e-6, need))) * m));
    }
    if (h.hunger >= 1) {
      // Starvation takes a share of the herd each step (on average), not a fixed number.
      const loss = h.count * (sp.predator ? 0.004 : 0.012) * m;
      h.count -= Math.floor(loss) + (this.rng.chance(loss - Math.floor(loss)) ? 1 : 0);
    }
    if (h.count <= 0) return;

    // Moving.
    if (h.next >= 0) {
      h.progress += (sp.speed * (0.7 + 0.6 * h.genes[2]) * ((HERD_DT * m) / 60) * (danger ? 1.8 : 1)) / Math.max(1, world.kmBetween(h.cell, h.next));
      if (h.progress >= 1) {
        h.cell = h.next;
        h.next = -1;
        h.progress = 0;
      }
    } else if (sp.predator) {
      this.hunt(h, world);
    } else {
      const here = this.pasture(h, world, h.cell, t);
      if (danger || here < 0.25 || h.hunger > 0.55 || this.rng.chance(perStep(0.03, m))) {
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
    if (h.count > sp.maxCount && this.data.herds.length < this.herdCap) {
      const half = Math.floor(h.count / 2);
      h.count -= half;
      const child = this.addHerd(h.species, h.cell, half, h.genes, h.kind);
      if (child) child.hunger = h.hunger;
    }
  }

  /** How good a cell is for a herd to graze (0 = not at all). */
  private pasture(h: Herd, world: World, cell: number, t: number): number {
    const planet = world.planet;
    if (planet.heightM[cell] < 0) return 0;
    const st = world.cellState(cell, t);
    if (st.burning || st.lavaHeat > 0 || st.water > 0.2) return 0;
    this.dayTemperature(world, cell, t);
    const habitat = habitatScore(SPECIES[h.species], planet.biome[cell], this.feltTemperature(h, planet.temperature[cell] + this.climateNow));
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
    if (!prey || prey.count <= 0 || !world.within(prey.cell, h.cell, world.kmPerCell * 11)) {
      prey = undefined;
      let bestKm = world.kmPerCell * 10;
      for (const o of this.data.herds) {
        if (o.count <= 0 || SPECIES[o.species].predator || !world.within(o.cell, h.cell, bestKm)) continue;
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
    prey.fear = this.data.t;
    if (prey.cell === h.cell) {
      if (prey.species === 'mammoth' && !this.rng.chance(0.3 * (1.4 - prey.genes[0] * 0.8))) return;
      // Fast prey escapes more often; fast wolves catch more.
      if (!this.rng.chance(clamp(1.15 - prey.genes[2] * 0.6 + h.genes[2] * 0.3, 0.2, 1))) return;
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

  /** The leader of the group nearest to a place, within `km`. */
  private nearestLeader(world: World, cell: number, km: number): number | undefined {
    let best: number | undefined;
    let bestKm = km;
    for (const b of this.data.bands) {
      const l = this.person(b.leader);
      if (!l?.alive) continue;
      const d = world.kmBetween(l.cell, cell);
      if (d <= bestKm) {
        bestKm = d;
        best = l.id;
      }
    }
    return best;
  }

  /** Checks a power aimed at a person before it is used; null when it can be used. */
  check(kind: PowerKind, p: Person, other?: Person): PowerBlock | null {
    const age = this.ageOf(p);
    switch (kind) {
      case 'fertility': {
        const q = p.partner >= 0 ? this.person(p.partner) : undefined;
        if (!q?.alive || q.sex === p.sex) return 'noPartner';
        const woman = p.sex === 'f' ? p : q;
        if (woman.pregnant) return 'pregnant';
        if (this.ageOf(woman) < 14) return 'young';
        return null;
      }
      case 'wLove':
        if (age < 13) return 'young';
        if (other && other.id === p.id) return 'samePerson';
        return null;
      case 'wEmigrate':
        return age < ADULT_AGE ? 'young' : null;
      case 'wLead':
        if (age < ADULT_AGE) return 'young';
        return this.isLeader(p) ? 'alreadyLeader' : null;
      case 'wPeace':
        if (age < 3) return 'young';
        return p.rels.some((r) => r[1] < -10) ? null : 'noEnemies';
      case 'wCourage':
      case 'wFear':
      case 'wAnger':
      case 'wForgive':
      case 'wComfort':
        return age < 3 ? 'young' : null;
      case 'wIdea':
        if (age < 14) return 'young';
        return nextSteps(p.know).length > 0 ? null : 'noIdea';
      case 'wTeach':
        if (age < ADULT_AGE) return 'young';
        return p.know ? null : 'nothingToTeach';
      default:
        return null;
    }
  }

  /** What a power does to the living (its effect on the land is handled by the World). */
  applyEvent(e: PowerEvent, world: World): EventOutcome {
    this.ensureBands(world);
    // Derived helpers start fresh, exactly as after restoring a snapshot.
    this.seasonDay = -1;
    this.invalidateKnowledge();
    this.gameCache.clear();
    const rng = new Rng(e.seed).fork('life');
    const t = this.data.t;
    const within = (km: number) => this.data.people.filter((p) => p.alive && world.within(p.cell, e.cell, km));
    const target = e.target !== undefined ? this.person(e.target) : undefined;
    const outcome: EventOutcome = {};
    if (CHRONICLED.has(e.kind) && e.cell >= 0) {
      const near = this.nearestLeader(world, e.cell, 900);
      this.chron('power', { s: e.kind, ...(near !== undefined ? { a: near } : {}) });
    } else if (e.kind === 'iceAge' || e.kind === 'heatAge') {
      this.chron('power', { s: e.kind, major: 1 });
    }
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
          this.addMood(p, 'miracle', 12, 15);
        }
        break;
      case 'revive': {
        const p = target;
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
          this.addMood(p, 'miracle', 25, 30);
          this.chron('power', { s: 'revive', a: p.id, major: 1 });
          // Those who grieved are glad again.
          for (const q of this.data.people) q.moods = q.moods.filter((m) => !(m.key === 'grief' && m.other === p.id));
          if (!this.bandById.has(p.band)) {
            const band = this.newBand(p.id);
            p.band = band.id;
          }
          this.invalidateKnowledge();
        }
        break;
      }
      case 'createPeople': {
        const count = Math.max(1, Math.min(10, e.extra ?? 1));
        const near = this.nearestLeader(world, e.cell, world.kmPerCell * 6);
        const band = near !== undefined ? this.person(near)!.band : this.newBand(-1).id;
        const made: Person[] = [];
        for (let i = 0; i < count; i++) {
          const p = this.addPerson(world, e.cell, rng, { band });
          if (p) made.push(p);
        }
        for (const p of made) for (const q of made) if (p !== q) this.addOp(p, q.id, Math.round(rng.range(5, 20)));
        const b = this.bandById.get(band);
        if (b && b.leader < 0) this.electLeader(b, false);
        if (made.length > 0) this.chron('newcomers', { n: made.length, a: made[0].id, major: 1 });
        // Far from everyone else they are a people of their own.
        if (b && near === undefined && made.length > 0 && this.tribes.tribes.length > 0) this.tribes.found(b, 'appeared');
        break;
      }
      case 'spawnAnimals': {
        if ((e.extra ?? 0) >= SPECIES_IDS.length) {
          // A new species nobody has seen before.
          const base = SPECIES_IDS[rng.int(0, SPECIES_IDS.length - 1)];
          const genes: [number, number, number] = [0.5, 0.5, 0.5];
          const strong = rng.int(0, 2);
          for (let i = 0; i < 3; i++) genes[i] = clamp(0.5 + (i === strong ? (rng.chance(0.5) ? 1 : -1) * rng.range(0.32, 0.45) : rng.range(-0.15, 0.15)), 0.03, 0.97);
          const rec = this.newSpecies(base, genePrefix(genes, [0.5, 0.5, 0.5]), genes);
          const [lo, hi] = SPECIES[base].startCount;
          this.addHerd(base, Life.nearestLand(world, e.cell), rng.int(lo, hi), genes, rec.id);
          this.chron('species', { n: rec.id, s: 'god', major: 1 });
          break;
        }
        const species = SPECIES_IDS[Math.max(0, Math.min(SPECIES_IDS.length - 1, e.extra ?? 0))];
        const [lo, hi] = SPECIES[species].startCount;
        this.addHerd(species, Life.nearestLand(world, e.cell), rng.int(lo, hi));
        break;
      }
      case 'timeSkip':
        this.data.coarseUntil = t + Math.max(0, e.extra ?? 0);
        break;
      case 'smite':
        if (target?.alive) this.die(target, 'god');
        break;
      case 'plague':
        for (const p of within(450)) if (!p.immune && rng.chance(0.6)) this.makeSick(p);
        break;
      case 'move': {
        const p = target;
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
          p.dest = undefined;
          this.log(p, 'carried');
          // Carried far from the group: start a new one.
          const leader = this.leaderOf(p);
          if (leader && !world.within(leader.cell, p.cell, world.kmPerCell * 20)) {
            const band = this.newBand(p.id);
            p.band = band.id;
            this.invalidateKnowledge();
          }
        }
        break;
      }
      case 'harvest':
        for (const cell of [...this.food.keys()]) if (world.kmBetween(cell, e.cell) <= 400) this.food.delete(cell);
        break;
      case 'luck':
        if (target?.alive) {
          target.luck = t + YEAR;
          this.log(target, 'lucky');
          this.addMood(target, 'luck', 15, DAYS_PER_YEAR);
          outcome.person = target.id;
          outcome.result = 'accepted';
        }
        break;
      case 'fertility':
        if (target?.alive && this.check('fertility', target) === null) {
          const q = this.person(target.partner)!;
          const [woman, man] = target.sex === 'f' ? [target, q] : [q, target];
          woman.pregnant = { father: man.id, due: t + PREGNANCY };
          for (const x of [woman, man]) {
            this.log(x, 'blessedChild');
            this.addMood(x, 'miracle', 12, 20);
          }
          outcome.person = target.id;
          outcome.result = 'accepted';
        }
        break;
      case 'sign': {
        const variant = Math.max(0, Math.min(2, e.extra ?? 0));
        const km = variant === 2 ? Infinity : variant === 1 ? 700 : 500;
        for (const p of this.data.people) {
          if (!p.alive || world.kmBetween(p.cell, e.cell) > km) continue;
          this.addMood(p, 'sign', 10, 12);
          this.log(p, 'sawSign', { n: variant });
          p.awe = t + 4 * 60;
        }
        const near = this.nearestLeader(world, e.cell, 900);
        this.chron('sign', { n: variant, ...(near !== undefined ? { a: near } : {}) });
        break;
      }
      case 'wLove':
      case 'wCourage':
      case 'wFear':
      case 'wAnger':
      case 'wForgive':
      case 'wComfort':
      case 'wEmigrate':
      case 'wPeace':
      case 'wLead':
      case 'wIdea':
      case 'wTeach':
        if (target?.alive) {
          const other = e.other !== undefined ? this.person(e.other) : undefined;
          outcome.person = target.id;
          this.idea = undefined;
          outcome.result = this.whisper(e.kind, target, other, world, t, rng);
          if (this.idea) outcome.invention = this.idea;
        }
        break;
      default:
        break;
    }
    this.faith.witness(e, world);
    this.civ.onPower(e, world);
    return outcome;
  }

  /** A whispered thought: a strong push, but not an order. Character decides how well it works. */
  private whisper(kind: PowerKind, p: Person, other: Person | undefined, world: World, t: number, rng: RandomSource): 'accepted' | 'resisted' | 'noPlace' {
    if (this.check(kind, p, other) !== null) return 'resisted';
    const tr = p.traits;
    const take = (chance: number) => {
      if (rng.chance(clamp(chance, 0.05, 0.97))) return true;
      this.log(p, 'resisted');
      return false;
    };
    switch (kind) {
      case 'wLove': {
        if (!other?.alive) return 'resisted';
        const op = this.opinion(p, other.id);
        const chance = 0.9 - (op < -40 ? 0.5 : 0) - (p.partner >= 0 && p.partner !== other.id ? 0.35 : 0);
        if (!take(chance)) return 'resisted';
        this.setOp(p, other.id, Math.max(op, 80));
        if (this.isCloseKin(p, other) || other.sex === p.sex || this.ageOf(other) < ADULT_AGE || this.ageOf(p) < ADULT_AGE) {
          this.addOp(other, p.id, 20);
          return 'accepted';
        }
        this.log(p, 'inLove', { other: other.id });
        if (p.partner === other.id) return 'accepted';
        // Love is catching: the other one is drawn to them.
        if (this.opinion(other, p.id) >= -20) this.addOp(other, p.id, 35);
        if (this.opinion(other, p.id) >= 50 && other.partner < 0) {
          if (p.partner >= 0) {
            const old = this.person(p.partner);
            if (old?.alive) this.separate(p, old);
            else p.partner = -1;
          }
          if (this.canCourt(p, other)) this.becomeCouple(p, other);
        }
        return 'accepted';
      }
      case 'wCourage':
        if (!take(0.85 - (p.feel?.kind === 'fear' ? 0.2 : 0))) return 'resisted';
        p.feel = { kind: 'courage', until: t + YEAR };
        p.traits[T_BRAVE] = Math.min(100, p.traits[T_BRAVE] + 5);
        this.addMood(p, 'courage', 10, DAYS_PER_YEAR);
        this.log(p, 'brave');
        return 'accepted';
      case 'wFear':
        if (!take(0.85 - tr[T_BRAVE] / 250)) return 'resisted';
        p.feel = { kind: 'fear', until: t + 30 * DAY };
        this.addMood(p, 'fear', -12, 30);
        this.log(p, 'afraid');
        return 'accepted';
      case 'wAnger':
        if (!take(0.9 - tr[T_KIND] / 220)) return 'resisted';
        p.feel = { kind: 'anger', until: t + 15 * DAY };
        this.addMood(p, 'anger', -10, 15);
        this.log(p, 'angry');
        this.tribes.onAngerWhisper(p);
        return 'accepted';
      case 'wForgive':
        if (!take(0.9 - tr[T_AGGRESSIVE] / 220)) return 'resisted';
        for (const r of p.rels) if (r[1] < 0) r[1] = 10;
        for (const q of this.data.people) {
          if (!q.alive || q === p) continue;
          const r = this.findRel(q, p.id);
          if (r && r[1] < 0) r[1] = Math.min(10, r[1] + 25);
        }
        p.moods = p.moods.filter((m) => m.key !== 'quarrel' && m.key !== 'anger');
        if (p.feel?.kind === 'anger') p.feel = undefined;
        this.addMood(p, 'forgive', 8, 20);
        this.log(p, 'forgave');
        return 'accepted';
      case 'wComfort':
        if (!take(0.95)) return 'resisted';
        for (const m of p.moods) if (m.key === 'grief' || m.key === 'fear' || m.key === 'separated') m.v = Math.round(m.v / 2);
        p.moods = p.moods.filter((m) => m.key !== 'quarrel');
        if (p.feel?.kind === 'fear') p.feel = undefined;
        p.social = 0;
        this.addMood(p, 'comfort', 15, 10);
        this.log(p, 'comforted');
        return 'accepted';
      case 'wEmigrate': {
        const chance = 0.35 + tr[T_CURIOUS] / 250 + tr[T_BRAVE] / 250 + (p.feel?.kind === 'courage' ? 0.2 : 0);
        if (!take(chance)) return 'resisted';
        return this.emigrate(p, world, t) ? 'accepted' : 'noPlace';
      }
      case 'wPeace': {
        if (!take(0.9 - tr[T_AGGRESSIVE] / 200)) return 'resisted';
        for (const r of p.rels) {
          if (r[1] >= -10) continue;
          r[1] = 15;
          const q = this.person(r[0]);
          if (q?.alive) {
            this.setOp(q, p.id, Math.max(this.opinion(q, p.id) + 30, 5));
            this.addMood(q, 'peace', 10, 15);
          }
        }
        if (p.feel?.kind === 'anger') p.feel = undefined;
        this.addMood(p, 'peace', 10, 15);
        this.log(p, 'madePeace');
        if (this.isLeader(p)) this.tribes.onPeaceWhisper(p);
        return 'accepted';
      }
      case 'wIdea': {
        // Only the next step: what this person is ready for, the most fitting idea first.
        const c = this.circumstances(p, world, t);
        const options = nextSteps(p.know).sort((a, b) => circumstanceFactor(b, c) - circumstanceFactor(a, c));
        if (!take(0.55 + (tr[T_CLEVER] + tr[T_CURIOUS]) / 400)) return 'resisted';
        const id = options[0];
        this.idea = id;
        if (this.bandKnows(p.band) & BIT[id] || this.worldKnows() & BIT[id]) {
          this.learn(p, id);
          this.log(p, 'invented', { n: INVENTION_IDS.indexOf(id) });
          this.addMood(p, 'invented', 15, 30);
          this.data.everKnown |= BIT[id];
        } else this.invent(p, id);
        return 'accepted';
      }
      case 'wTeach':
        if (!take(0.5 + tr[T_KIND] / 250 + tr[T_CLEVER] / 400)) return 'resisted';
        p.teacher = t + 10 * YEAR;
        p.task = 'teach';
        this.log(p, 'teacher');
        return 'accepted';
      case 'wLead': {
        const chance = 0.35 + tr[T_AMBITIOUS] / 220 + tr[T_BRAVE] / 400 + tr[T_CLEVER] / 500;
        if (!take(chance)) return 'resisted';
        p.lead = t + 10 * YEAR;
        const band = this.bandById.get(p.band);
        if (band) {
          band.leader = p.id;
          this.log(p, 'leader');
          this.chron('leader', { a: p.id, major: 1 });
        }
        this.politics.onLeadWhisper(p);
        return 'accepted';
      }
      default:
        return 'resisted';
    }
  }
}

/** A chance per tick turned into a chance per step of k ticks. */
function perStep(p: number, k: number): number {
  return k === 1 ? p : 1 - Math.pow(1 - Math.min(p, 0.999), k);
}

function countKnown(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

function geneDistance(a: readonly number[], b: readonly number[]): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

const GENE_WORDS: [string, string][] = [
  ['giant', 'dwarf'],
  ['woolly', 'bare'],
  ['swift', 'heavy'],
];

/** A name part from how the genes changed: the strongest change, and the second if it is clear. */
export function genePrefix(genes: readonly number[], from: readonly number[]): string {
  const d = [0, 1, 2].map((i) => genes[i] - from[i]);
  const order = [0, 1, 2].sort((a, b) => Math.abs(d[b]) - Math.abs(d[a]));
  const word = (i: number) => GENE_WORDS[i][d[i] >= 0 ? 0 : 1];
  const parts = [word(order[0])];
  if (Math.abs(d[order[1]]) > 0.2) parts.push(word(order[1]));
  return parts.join('+');
}
