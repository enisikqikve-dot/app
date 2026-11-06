/**
 * Civilisation. A people that knows farming settles down: its group founds a
 * village, fields spread around it, and the village grows into a town and a
 * city. Only a few of its inhabitants are simulated one by one (the people
 * you can follow); the rest are counted: they are born, starve, fall ill and
 * die in numbers. Full towns send settlers out to found new villages. With
 * money, people earn and spend, rich and poor families appear, and markets set
 * the price of food. Once a year the world writes its statistics.
 */
import { Rng } from '../../core/rng';
import { MINUTES_PER_DAY, MINUTES_PER_YEAR } from '../clock';
import type { PowerEvent } from '../powers';
import type { World } from '../world';
import { CIV_BIT, CIV_IDS, CIV_TECHS, civReady, type CivId } from './civtech';
import { BIT, INVENTION_IDS } from './inventions';
import type { Life } from './life';
import type { Band, Person, Settlement, Tribe } from './types';
import { T_CLEVER, T_CURIOUS, T_DILIGENT } from './types';

const DAY = MINUTES_PER_DAY;
const YEAR = MINUTES_PER_YEAR;

/** Size thresholds: village, town, city, metropolis. */
export const SIZE_STEPS = [0, 150, 1500, 15000];
/** At most this many settlements on the planet. */
const MAX_SETTLEMENTS = 40;
/** People per field (more with better knowledge). */
const PER_FIELD = 22;

/** What one row of the yearly statistics holds. */
export const HISTORY_FIELDS = ['year', 'population', 'followed', 'peoples', 'settlements', 'believers', 'knowledge', 'wars', 'inequality', 'price'] as const;

const SYL_A = ['Ur', 'Ka', 'Ta', 'Me', 'Bo', 'Si', 'Al', 'No', 'Ri', 'Pe', 'Ha', 'Lu', 'Za', 'Dé', 'Mo', 'Ve', 'Ki', 'Ar'];
const SYL_B = ['ru', 'ma', 'lin', 'do', 'ka', 'sa', 'ri', 'tem', 'no', 'bar', 'el', 'ish', 'an', 'ur'];
const SYL_C = ['', '', 'a', 'on', 'is', 'ek', 'um', 'ra', 'heim', 'ta'];

/** How deadly each power is for a crowd within its reach: [km, share]. */
const HARM: Partial<Record<PowerEvent['kind'], [number, number]>> = {
  meteor: [500, 0.85],
  volcano: [300, 0.45],
  tsunami: [350, 0.35],
  quake: [350, 0.2],
  storm: [250, 0.05],
  fire: [150, 0.08],
  plague: [450, 0.3],
  smite: [60, 0.1],
  lightning: [40, 0.01],
};

export class CivSystem {
  constructor(private readonly life: Life) {}

  get settlements(): Settlement[] {
    const d = this.life.raw;
    if (!d.settlements) d.settlements = [];
    return d.settlements;
  }

  get history(): number[][] {
    const d = this.life.raw;
    if (!d.history) d.history = [];
    return d.history;
  }

  living(): Settlement[] {
    return this.settlements.filter((s) => s.ended === undefined);
  }

  settlement(id: number | undefined): Settlement | undefined {
    if (id === undefined) return undefined;
    return this.settlements.find((s) => s.id === id);
  }

  /** Everyone: the people you can follow plus the counted crowds. */
  totalPopulation(): number {
    let n = this.life.population();
    for (const s of this.settlements) if (s.ended === undefined) n += Math.floor(s.crowd);
    return n;
  }

  /** People of a settlement (followed and counted). */
  inhabitants(s: Settlement): number {
    return this.life.members(s.band).length + Math.floor(s.crowd);
  }

  sizeOf(s: Settlement): 0 | 1 | 2 | 3 {
    const n = this.inhabitants(s);
    return n >= SIZE_STEPS[3] ? 3 : n >= SIZE_STEPS[2] ? 2 : n >= SIZE_STEPS[1] ? 1 : 0;
  }

  /** The village of a group, if it has one. */
  homeOf(bandId: number): Settlement | undefined {
    const band = this.life.band(bandId);
    return band?.home !== undefined ? this.settlement(band.home) : undefined;
  }

  knows(tribe: Tribe | undefined, id: CivId): boolean {
    return !!tribe && !!((tribe.tech ?? 0) & CIV_BIT[id]);
  }

  /** Does the people of this group know something? */
  bandKnows(bandId: number, id: CivId): boolean {
    return this.knows(this.life.tribes.tribeOfBand(bandId), id);
  }

  /** How many people a group in a village may have before births happen in the crowd instead. */
  followCap(): number {
    return Math.max(6, Math.min(22, Math.floor(170 / Math.max(1, this.living().length))));
  }

  /** In a full village, children are born into the counted crowd. */
  bandFull(bandId: number): boolean {
    const band = this.life.band(bandId);
    if (band?.home === undefined) return false;
    return this.life.members(bandId).length >= this.followCap();
  }

  /** A birth that happens in the crowd. */
  crowdBirth(bandId: number): void {
    const s = this.homeOf(bandId);
    if (s) s.crowd += 1;
  }

  private techFactor(tribe: Tribe | undefined): number {
    if (!tribe) return 1;
    const k = (id: CivId, f: number) => (this.knows(tribe, id) ? f : 0);
    return 1 + k('herding', 0.25) + k('wheel', 0.15) + k('masonry', 0.1) + k('weaving', 0.05) + k('writing', 0.05);
  }

  private newName(id: number): string {
    const rng = new Rng((id * 104729) ^ Math.floor(this.life.t / DAY));
    let name = rng.pick(SYL_A) + rng.pick(SYL_B) + rng.pick(SYL_C);
    if (name.length > 10) name = name.slice(0, 10);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  // ------------------------------------------------------------ people

  /** Once a day for each person: work earns money, children learn what is written down. */
  personDaily(p: Person, age: number): void {
    const life = this.life;
    const tribe = life.tribes.tribeOfBand(p.band);
    if (!tribe) return;
    // With writing, the young learn the old knowledge from the elders' writings.
    if (tribe.lore && age >= 12 && age - 1 / 40 < 12) {
      const missing = tribe.lore & ~p.know;
      for (const id of INVENTION_IDS) if (missing & BIT[id]) life.learn(p, id);
    }
    // A state religion: those who believe in nothing follow it in time.
    if (tribe.laws?.includes('faith') && (p.belief ?? -1) < 0 && age >= 13 && life.rng.chance(0.002)) {
      const rel = life.tribes.mainBelief(tribe);
      if (rel >= 0) {
        p.belief = rel;
        p.faith = Math.max(p.faith ?? 0, 0.3);
      }
    }
    if (!this.knows(tribe, 'money') || age < 15) return;
    const band = life.band(p.band);
    if (band?.home === undefined) return;
    const laws = tribe.laws ?? [];
    let income = 0.4 + p.traits[T_DILIGENT] / 150 + p.traits[T_CLEVER] / 300 + (p.task === 'farm' ? 0.2 : 0) + (life.isLeader(p) ? 0.8 : 0) + (tribe.chief === p.id ? 2 : 0);
    if (laws.includes('market')) income *= 1.1;
    if (laws.includes('tax')) {
      const tax = income * 0.1;
      income -= tax;
      tribe.treasury = (tribe.treasury ?? 0) + tax;
    }
    // Things wear out and are used up: wealth settles where income and spending meet.
    const w = Math.max(0, ((p.wealth ?? 0) + income - 0.55) * 0.998);
    p.wealth = Math.round(w * 100) / 100;
  }

  /** The dead leave what they had to their children (or partner, or the people). */
  onDeath(p: Person): void {
    const w = p.wealth ?? 0;
    if (w <= 0) return;
    const life = this.life;
    const heirs = life.childrenOf(p.id).filter((c): c is Person => 'alive' in c && c.alive);
    const partner = p.partner >= 0 ? life.person(p.partner) : undefined;
    const to = heirs.length ? heirs : partner?.alive ? [partner] : [];
    if (to.length === 0) {
      const tribe = life.tribes.tribeOfBand(p.band);
      if (tribe) tribe.treasury = (tribe.treasury ?? 0) + w;
    } else {
      for (const h of to) {
        h.wealth = Math.round(((h.wealth ?? 0) + w / to.length) * 100) / 100;
        life.log(h, 'inherited', { other: p.id });
      }
    }
    p.wealth = 0;
  }

  /** Median wealth of each group (worked out once a step). */
  private medians = new Map<number, number>();
  private mediansAt = -1;

  /** Rich or poor compared with the neighbours. */
  standing(p: Person): 'rich' | 'poor' | null {
    if (p.wealth === undefined) return null;
    const band = this.life.band(p.band);
    if (band?.home === undefined) return null;
    // Worked out again every step (the same in a world restored from a snapshot).
    if (this.life.t !== this.mediansAt) {
      this.medians.clear();
      this.mediansAt = this.life.t;
    }
    let median = this.medians.get(p.band);
    if (median === undefined) {
      const ws = this.life
        .members(p.band)
        .filter((q) => q.wealth !== undefined && this.life.ageOf(q) >= 15)
        .map((q) => q.wealth!)
        .sort((a, b) => a - b);
      median = ws.length < 3 ? -1 : ws[Math.floor(ws.length / 2)];
      this.medians.set(p.band, median);
    }
    if (median < 0) return null;
    if (p.wealth > Math.max(3, median * 2.5)) return 'rich';
    if (p.wealth < Math.min(1, median * 0.3)) return 'poor';
    return null;
  }

  /** A disaster hits the crowds, a blessing fills the fields. */
  onPower(e: PowerEvent, world: World): void {
    if (e.cell < 0) return;
    if (e.kind === 'harvest' || e.kind === 'rain') {
      for (const s of this.living()) if (world.within(s.cell, e.cell, 450)) s.blessed = this.life.t + YEAR;
      return;
    }
    const harm = HARM[e.kind];
    if (!harm) return;
    for (const s of this.living()) {
      if (!world.within(s.cell, e.cell, harm[0])) continue;
      const share = e.kind === 'tsunami' && world.planet.heightM[s.cell] > 60 ? harm[1] * 0.2 : harm[1];
      s.crowd = Math.round(s.crowd * (1 - share) * 100) / 100;
    }
  }

  // ------------------------------------------------------------ every day

  daily(world: World, t: number): void {
    const life = this.life;
    // Groups of farming peoples settle down.
    for (const band of life.bands) {
      if (band.home !== undefined) continue;
      const tribe = life.tribes.tribe(band.tribe);
      if (!this.knows(tribe, 'farming')) continue;
      this.trySettle(band, tribe!, world, t);
    }
    // Villages whose people you followed are gone: someone from the crowd steps forward.
    for (const s of this.living()) {
      const band = life.band(s.band);
      const n = band ? life.members(band.id).length : 0;
      if (n < Math.min(6, this.followCap() / 2) && s.crowd >= 1) {
        const target = band ?? life.createBand(-1, s.tribe, s.id);
        if (!band) s.band = target.id;
        if (life.addAdult(world, s.cell, target.id)) s.crowd -= 1;
        if (target.leader < 0) life.chooseLeader(target);
      } else if (!band) {
        s.ended = t;
        life.chron('abandoned', { n: s.id, x: s.tribe, major: 1 });
      }
    }
    if (Math.floor(t / DAY) % 40 === 11) this.yearly(world, t);
  }

  private trySettle(band: Band, tribe: Tribe, world: World, t: number): void {
    const life = this.life;
    const members = life.members(band.id);
    if (members.length < 5 || this.living().length >= MAX_SETTLEMENTS) return;
    const leader = life.person(band.leader);
    if (!leader?.alive || leader.dest !== undefined) return;
    const cell = leader.cell;
    if (life.capacity(world, cell, t) < 0.35 || life.waterScore(world, cell) <= 0) return;
    if (this.living().some((s) => world.within(s.cell, cell, world.kmPerCell * 3))) return;
    if (!life.rng.chance(0.08)) return;
    this.found(band, tribe, cell, t, leader);
  }

  private found(band: Band, tribe: Tribe, cell: number, t: number, by: Person | undefined, from?: Settlement): Settlement {
    const life = this.life;
    const id = life.raw.nextId++;
    const s: Settlement = { id, name: this.newName(id), cell, tribe: tribe.id, band: band.id, founded: t, crowd: 0, fields: 2, price: 100, grew: 0 };
    this.settlements.push(s);
    band.home = id;
    if (by) life.log(by, 'settled', { n: id });
    const first = this.settlements.length === 1;
    life.chron(from ? 'colony' : 'settled', { n: id, x: tribe.id, ...(by ? { a: by.id } : {}), ...(from ? { c: from.id } : {}), ...(first || !from ? { major: 1 as const } : {}) });
    return s;
  }

  // ------------------------------------------------------------ every year

  private yearly(world: World, t: number): void {
    const life = this.life;
    for (const tribe of life.tribes.living()) this.discover(tribe, world);
    for (const s of this.living()) this.grow(s, world, t);
    this.record(t);
  }

  /** Peoples find new knowledge of civilisation. */
  private discover(tribe: Tribe, world: World): void {
    const life = this.life;
    const bands = life.bands.filter((b) => b.tribe === tribe.id);
    if (bands.length === 0) return;
    let stone = 0;
    let pop = 0;
    for (const b of bands) {
      stone |= life.bandKnows(b.id);
      pop += life.members(b.id).length;
    }
    const homes = this.living().filter((s) => s.tribe === tribe.id);
    for (const s of homes) pop += s.crowd;
    // Writing keeps the stone-age knowledge.
    if (this.knows(tribe, 'writing')) tribe.lore = (tribe.lore ?? 0) | stone;
    const tech = tribe.tech ?? 0;
    for (const id of civReady(tech, stone)) {
      const def = CIV_TECHS[id];
      if (def.settled && homes.length === 0) continue;
      if (def.minPop && pop < def.minPop) continue;
      let chance = def.rate * Math.min(3, Math.sqrt(pop / 60)) * (0.6 + tribe.culture[2] / 100);
      if (id === 'farming') {
        const seen = bands.reduce((m, b) => Math.max(m, b.seen?.[3] ?? 0), 0);
        chance *= 1 + Math.min(1, seen);
        const leader = life.person(bands[0].leader);
        if (leader) chance *= 0.5 + Math.min(1.5, life.capacity(world, leader.cell, life.t));
      }
      if (id === 'money' && (tribe.traded?.length ?? 0) > 0) chance *= 1.5;
      if (!life.rng.chance(Math.min(0.5, chance))) continue;
      this.learnTech(tribe, id, true);
    }
  }

  /** A people learns something (found it themselves, or from others). */
  learnTech(tribe: Tribe, id: CivId, own: boolean, from?: Tribe): void {
    const life = this.life;
    if (this.knows(tribe, id)) return;
    tribe.tech = (tribe.tech ?? 0) | CIV_BIT[id];
    // Who had the idea: the cleverest, most curious adult.
    let who: Person | undefined;
    let best = -1;
    for (const b of life.bands) {
      if (b.tribe !== tribe.id) continue;
      for (const p of life.members(b.id)) {
        if (life.ageOf(p) < 16) continue;
        const s = p.traits[T_CLEVER] + p.traits[T_CURIOUS] + life.rng.next() * 30;
        if (s > best) {
          best = s;
          who = p;
        }
      }
    }
    if (who && own) life.log(who, 'civInvented', { n: CIV_IDS.indexOf(id) });
    const firstEver = own && !this.life.tribes.tribes.some((tr) => tr !== tribe && this.knows(tr, id));
    life.chron('civTech', { x: tribe.id, s: id, ...(who && own ? { a: who.id } : {}), ...(from ? { y: from.id } : {}), ...(firstEver ? { major: 1 as const } : {}) });
  }

  /** Neighbours trading teach each other their crafts. */
  shareByTrade(a: Tribe, b: Tribe): void {
    const life = this.life;
    for (const [from, to] of [
      [a, b],
      [b, a],
    ]) {
      const ready = CIV_IDS.filter((id) => this.knows(from, id) && !this.knows(to, id) && CIV_TECHS[id].needs.every((n) => this.knows(to, n)));
      if (ready.length && life.rng.chance(0.25)) this.learnTech(to, ready[life.rng.int(0, ready.length - 1)], false, from);
    }
  }

  /** A village grows (or shrinks), clears fields, builds and sends out settlers. */
  private grow(s: Settlement, world: World, t: number): void {
    const life = this.life;
    const tribe = life.tribes.tribe(s.tribe);
    const agents = life.members(s.band).length;
    const total = agents + s.crowd;
    const planet = world.planet;
    let land = 1;
    for (let k = planet.neighborOffsets[s.cell]; k < planet.neighborOffsets[s.cell + 1]; k++) {
      const n = planet.neighbors[k];
      if (planet.heightM[n] < 0) continue;
      land++;
      for (let j = planet.neighborOffsets[n]; j < planet.neighborOffsets[n + 1]; j++) if (planet.heightM[planet.neighbors[j]] >= 0) land += 0.35;
    }
    const soil = Math.max(0.3, Math.min(1.4, life.capacity(world, s.cell, t - (t % YEAR) + YEAR / 2)));
    const techF = this.techFactor(tribe);
    const maxFields = Math.round((4 + land * 3) * soil * techF);
    const wanted = Math.ceil(total / (PER_FIELD * 0.8));
    if (s.fields < Math.min(maxFields, wanted)) s.fields += 1;
    else if (s.fields > maxFields) s.fields -= 1;
    const cap = s.fields * PER_FIELD * techF * (s.blessed !== undefined && s.blessed > t ? 1.3 : 1);
    const herbs = tribe && (tribe.lore ?? 0) & BIT.herbs ? 0.008 : 0;
    const r = 0.028 + herbs;
    let crowd = s.crowd + r * total * (1 - total / Math.max(1, cap));
    if (total > cap) crowd -= (total - cap) * 0.2;
    // Wars and unrest cost lives too.
    if (tribe && life.tribes.wars.some((w) => w.end === undefined && (w.a === tribe.id || w.b === tribe.id))) crowd *= 0.985;
    s.crowd = Math.max(0, Math.round(crowd * 100) / 100);
    // Food price: how many mouths per harvest.
    s.price = Math.round(Math.max(30, Math.min(400, 100 * (total / Math.max(1, cap * 0.85)))));
    // Taxes build a temple (with a religion) and a wall (in times of war).
    if (tribe && (tribe.treasury ?? 0) > 60) {
      if (!s.temple && life.tribes.mainBelief(tribe) >= 0 && this.knows(tribe, 'masonry')) {
        s.temple = true;
        tribe.treasury! -= 60;
      } else if (!s.wall && this.knows(tribe, 'masonry') && life.tribes.wars.some((w) => w.end === undefined && (w.a === tribe.id || w.b === tribe.id))) {
        s.wall = true;
        tribe.treasury! -= 60;
      }
    }
    // Growing into a town or a city.
    const size = this.sizeOf(s);
    if (size > s.grew) {
      s.grew = size;
      life.chron('grew', { n: s.id, x: s.tribe, s: String(size), major: 1 });
    }
    // A full town sends settlers out.
    if (total > cap * 0.85 && s.crowd >= 25 && this.living().length < MAX_SETTLEMENTS && life.rng.chance(0.3)) this.colonize(s, world, t);
  }

  private colonize(from: Settlement, world: World, t: number): void {
    const life = this.life;
    const tribe = life.tribes.tribe(from.tribe);
    if (!tribe) return;
    const planet = world.planet;
    let best = -1;
    let bestScore = -Infinity;
    const seen = new Set([from.cell]);
    let frontier = [from.cell];
    for (let step = 1; step <= 9; step++) {
      const next: number[] = [];
      for (const c of frontier) {
        for (let k = planet.neighborOffsets[c]; k < planet.neighborOffsets[c + 1]; k++) {
          const n = planet.neighbors[k];
          if (seen.has(n) || planet.heightM[n] < 0) continue;
          seen.add(n);
          next.push(n);
          if (step < 4) continue;
          if (life.waterScore(world, n) <= 0) continue;
          const food = life.capacity(world, n, t);
          if (food < 0.3 || this.living().some((s) => world.within(s.cell, n, world.kmPerCell * 3.5))) continue;
          const score = food + life.rng.next() * 0.3;
          if (score > bestScore) {
            bestScore = score;
            best = n;
          }
        }
      }
      frontier = next;
    }
    if (best < 0) return;
    const band = life.createBand(-1, tribe.id);
    const settlers = Math.min(6, Math.floor(from.crowd));
    let made = 0;
    for (let i = 0; i < settlers; i++) if (life.addAdult(world, best, band.id)) made++;
    if (made === 0) {
      life.dropBand(band);
      return;
    }
    from.crowd -= made;
    life.chooseLeader(band);
    const s = this.found(band, tribe, best, t, life.person(band.leader), from);
    s.crowd = Math.min(from.crowd, 10);
    from.crowd -= s.crowd;
  }

  /** Inequality of wealth (Gini, 0 … 1) among the followed people of a people (or everyone). */
  inequality(tribe?: Tribe): number {
    const life = this.life;
    const ws: number[] = [];
    for (const p of life.people) {
      if (!p.alive || p.wealth === undefined || life.ageOf(p) < 15) continue;
      if (tribe && life.band(p.band)?.tribe !== tribe.id) continue;
      ws.push(p.wealth);
    }
    if (ws.length < 3) return 0;
    ws.sort((a, b) => a - b);
    const sum = ws.reduce((a, b) => a + b, 0);
    if (sum <= 0) return 0;
    let acc = 0;
    for (let i = 0; i < ws.length; i++) acc += (2 * (i + 1) - ws.length - 1) * ws[i];
    return acc / (ws.length * sum);
  }

  /** One row of statistics for this year. */
  private record(t: number): void {
    const life = this.life;
    const year = Math.floor(t / YEAR);
    const rows = this.history;
    if (rows.length && rows[rows.length - 1][0] >= year) return;
    let believers = 0;
    let alive = 0;
    for (const p of life.people) {
      if (!p.alive) continue;
      alive++;
      if ((p.belief ?? -1) >= 0) believers++;
    }
    let civ = 0;
    for (const tr of life.tribes.living()) civ = Math.max(civ, countBits(tr.tech ?? 0));
    const homes = this.living();
    const price = homes.length ? Math.round(homes.reduce((s, h) => s + h.price, 0) / homes.length) : 0;
    rows.push([
      year,
      this.totalPopulation(),
      alive,
      life.tribes.living().length,
      homes.length,
      alive ? Math.round((believers / alive) * 100) : 0,
      countBits(life.worldKnows()) + civ,
      life.tribes.wars.filter((w) => w.end === undefined).length,
      Math.round(this.inequality() * 100),
      price,
    ]);
  }
}

function countBits(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}
