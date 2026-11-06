/**
 * Life together. People have a trade you can see (farmer, smith, soldier,
 * priest …). They come together for weddings, harvest feasts and funerals.
 * Each grown-up has a dream for their life (to explore, to lead, to invent,
 * a big family …) and is happy when it comes true. Friendships grow into
 * best friends; murder, fights and theft can start a feud between two
 * families that lasts for generations, until a wedding, forgiveness or time
 * ends it.
 */
import { MINUTES_PER_DAY, MINUTES_PER_YEAR } from '../clock';
import type { World } from '../world';
import { BIT } from './inventions';
import type { Life } from './life';
import type { DreamId, Feud, Gathering, Person } from './types';
import { DREAMS, T_AGGRESSIVE, T_AMBITIOUS, T_BRAVE, T_CLEVER, T_CURIOUS, T_DILIGENT, T_KIND, T_PIOUS } from './types';

const DAY = MINUTES_PER_DAY;
const YEAR = MINUTES_PER_YEAR;

/** What someone does in life, as people would call it. */
export type Job =
  | 'child'
  | 'gatherer'
  | 'hunter'
  | 'fisher'
  | 'farmer'
  | 'builder'
  | 'healer'
  | 'teacher'
  | 'inventor'
  | 'firekeeper'
  | 'shaman'
  | 'priest'
  | 'smith'
  | 'trader'
  | 'soldier'
  | 'scholar'
  | 'chief'
  | 'ruler'
  | 'worker'
  | 'engineer'
  | 'doctor'
  | 'robot'
  | 'ai'
  | 'elder';

export class SocietySystem {
  constructor(private readonly life: Life) {}

  get gatherings(): Gathering[] {
    const d = this.life.raw;
    if (!d.gatherings) d.gatherings = [];
    return d.gatherings;
  }

  get feuds(): Feud[] {
    const d = this.life.raw;
    if (!d.feuds) d.feuds = [];
    return d.feuds;
  }

  // ------------------------------------------------------------ trades

  /** The trade of a person, from their work, their people's age and their place in society. */
  jobOf(p: Person): Job {
    const life = this.life;
    if (p.kind) return p.kind;
    const age = life.ageOf(p);
    if (age < 14) return 'child';
    const tribe = life.tribes.tribeOfBand(p.band);
    const civ = life.civ;
    if (tribe?.chief === p.id && tribe.gov && tribe.gov !== 'band') return 'ruler';
    if (life.isLeader(p)) return 'chief';
    if (p.shaman) return civ.knows(tribe, 'writing') ? 'priest' : 'shaman';
    const machines = civ.knows(tribe, 'steam');
    switch (p.task) {
      case 'hunt':
        return 'hunter';
      case 'guard':
        return 'soldier';
      case 'fish':
        return 'fisher';
      case 'farm':
        return 'farmer';
      case 'build':
        return 'builder';
      case 'heal':
        return civ.knows(tribe, 'medicine') ? 'doctor' : 'healer';
      case 'teach':
        return 'teacher';
      case 'tinker':
        return 'inventor';
      case 'fire':
        return age > 55 ? 'elder' : 'firekeeper';
      case 'rite':
        return 'shaman';
      case 'smith':
        return machines ? (civ.knows(tribe, 'electricity') ? 'engineer' : 'worker') : 'smith';
      case 'trade':
        return 'trader';
      case 'study':
        return 'scholar';
      default:
        return age > 60 ? 'elder' : 'gatherer';
    }
  }

  // ------------------------------------------------------------ gatherings

  /** The gathering a person's group holds now, if any. */
  gatheringFor(p: Person): Gathering | undefined {
    const t = this.life.t;
    return this.gatherings.find((g) => g.band === p.band && g.start <= t && g.until > t);
  }

  private hold(kind: Gathering['kind'], band: number, cell: number, hours: number, a?: number, b?: number): Gathering | null {
    const life = this.life;
    // One at a time per group.
    if (this.gatherings.some((g) => g.band === band && g.until > life.t)) return null;
    const g: Gathering = { id: life.raw.nextId++, kind, band, cell, start: life.t, until: life.t + hours * 60 };
    if (a !== undefined) g.a = a;
    if (b !== undefined) g.b = b;
    this.gatherings.push(g);
    return g;
  }

  /** A new couple: the group celebrates the wedding (and a wedding between feuding families ends the feud). */
  onCouple(a: Person, b: Person): void {
    const life = this.life;
    const band = life.band(a.band);
    const leader = band ? life.person(band.leader) : undefined;
    if (band && life.members(band.id).length >= 4) this.hold('wedding', band.id, leader?.cell ?? a.cell, 6, a.id, b.id);
    const ha = this.houseOf(a);
    const hb = this.houseOf(b);
    for (const f of this.feuds) {
      if (f.ended !== undefined) continue;
      if ((f.a === ha && f.b === hb) || (f.a === hb && f.b === ha)) this.endFeud(f, 'wedding', a, b);
    }
  }

  /** Someone died: those who knew them say goodbye (with burial rites or a faith). */
  onDeath(p: Person, cause: string): void {
    const life = this.life;
    if (life.ageOf(p) < 3 || cause === 'war') return;
    const band = life.band(p.band);
    if (!band || life.members(band.id).length < 3) return;
    const rites = life.bandKnows(band.id) & BIT.burial || (p.belief ?? -1) >= 0;
    if (!rites) return;
    this.hold('funeral', band.id, p.cell, 4, p.id);
  }

  /** What people do at a gathering (called when they are free). */
  attend(p: Person, world: World): boolean {
    const life = this.life;
    const g = this.gatheringFor(p);
    if (!g || p.kind === 'robot') return false;
    if (!world.within(g.cell, p.cell, world.kmPerCell * 3)) return false;
    if (p.cell !== g.cell) return life.goTo(p, world, (c) => c === g.cell, 6, 'gathering');
    life.start(p, g.kind === 'funeral' ? 'mourn' : 'celebrate', life.t, Math.min(180, g.until - life.t), true);
    return true;
  }

  /** The end of a gathering: everyone who came feels it. */
  finish(p: Person, action: 'celebrate' | 'mourn'): void {
    const life = this.life;
    if (action === 'mourn') {
      for (const m of p.moods) if (m.key === 'grief') m.v = Math.round(m.v * 0.7);
      life.addMood(p, 'mourned', 4, 10);
    } else {
      const g = this.gatherings.find((x) => x.band === p.band && x.until >= life.t - 4 * 60);
      life.addMood(p, g?.kind === 'wedding' ? 'wedding' : 'feast', 7, 12);
    }
  }

  /** Once a day: harvest feasts in autumn, old gatherings are cleared away, dreams and feuds age. */
  daily(t: number): void {
    const life = this.life;
    const day = Math.floor(t / DAY);
    const season = Math.floor((day % 40) / 10);
    for (const band of life.bands) {
      const n = life.members(band.id).length;
      if (n < 5) continue;
      // A harvest feast once every autumn (with song, fire or fields).
      const know = life.bandKnows(band.id);
      if (season !== 2 || !(know & (BIT.song | BIT.fire))) continue;
      if (!life.rng.chance(0.1)) continue;
      const year = Math.floor(t / YEAR);
      if (this.gatherings.some((g) => g.band === band.id && g.kind === 'feast' && Math.floor(g.start / YEAR) === year)) continue;
      const leader = life.person(band.leader);
      if (!leader?.alive) continue;
      const g = this.hold('feast', band.id, leader.cell, 8);
      const tribe = life.tribes.tribe(band.tribe);
      if (g && tribe && !tribe.feasted) {
        tribe.feasted = true;
        life.chron('feast', { x: tribe.id, a: leader.id, major: 1 });
      }
    }
    if (this.gatherings.length > 0 && this.gatherings.some((g) => g.until < t - DAY)) {
      life.raw.gatherings = this.gatherings.filter((g) => g.until >= t - DAY);
    }
    // Feuds fade after two generations.
    for (const f of this.feuds) if (f.ended === undefined && t - f.since > 60 * YEAR) this.endFeud(f, 'time');
  }

  // ------------------------------------------------------------ dreams

  /** At fifteen, everyone finds a dream for their life. */
  chooseDream(p: Person): void {
    const life = this.life;
    if (p.kind || p.dream) return;
    const tr = p.traits;
    const score: Record<DreamId, number> = {
      explore: tr[T_CURIOUS] + tr[T_BRAVE] * 0.6,
      lead: tr[T_AMBITIOUS] * 1.4,
      invent: tr[T_CLEVER] + tr[T_CURIOUS] * 0.5,
      family: tr[T_KIND] * 1.3 + 10,
      wealth: life.civ.bandKnows(p.band, 'money') ? tr[T_AMBITIOUS] + tr[T_DILIGENT] * 0.4 : 0,
      faith: tr[T_PIOUS] * 1.3,
      glory: tr[T_AGGRESSIVE] * 0.8 + tr[T_BRAVE] * 0.7,
      build: tr[T_DILIGENT] * 1.3,
    };
    let best: DreamId = 'family';
    let top = -Infinity;
    for (const d of DREAMS) {
      const s = score[d] + life.rng.next() * 35;
      if (s > top) {
        top = s;
        best = d;
      }
    }
    p.dream = best;
    life.log(p, 'dream', { n: DREAMS.indexOf(best) });
  }

  /** Something happened that may make a dream come true. */
  achieve(p: Person | undefined, dream: DreamId): void {
    if (!p?.alive || p.dream !== dream || p.dreamDone) return;
    const life = this.life;
    p.dreamDone = true;
    life.log(p, 'dreamDone', { n: DREAMS.indexOf(dream) });
    life.addMood(p, 'dream', 15, 2 * 40);
    const notable = life.isLeader(p) || life.population() < 60 || life.rng.chance(0.15);
    if (notable) life.chron('dream', { a: p.id, s: dream });
  }

  /** Once a day for each grown-up: dreams that come true by themselves, and regret in old age. */
  personDaily(p: Person, age: number): void {
    const life = this.life;
    if (p.kind) return;
    if (age >= 15 && !p.dream) this.chooseDream(p);
    if (!p.dream || p.dreamDone) return;
    if (p.dream === 'family' && life.childrenOf(p.id).filter((c) => 'alive' in c && c.alive).length >= 3) this.achieve(p, 'family');
    if (p.dream === 'wealth' && life.civ.standing(p) === 'rich') this.achieve(p, 'wealth');
    if (p.dream === 'faith' && p.shaman) this.achieve(p, 'faith');
    if (p.dream === 'build' && (p.built ?? 0) >= 3) this.achieve(p, 'build');
    if (p.dream === 'lead' && life.isLeader(p)) this.achieve(p, 'lead');
    // Getting old with a dream that never came true.
    if (age >= 62 && age - 1 / 40 < 62) life.addMood(p, 'regret', -6, 10 * 40);
  }

  // ------------------------------------------------------------ families and feuds

  /** The head of someone's family: the oldest known ancestor on the father's side (else the mother's), up to four generations. */
  houseOf(p: { id: number; mother: number; father: number }): number {
    const life = this.life;
    let cur: { id: number; mother: number; father: number } = p;
    for (let i = 0; i < 4; i++) {
      const up = cur.father >= 0 ? life.anyone(cur.father) : cur.mother >= 0 ? life.anyone(cur.mother) : undefined;
      if (!up) break;
      cur = up;
    }
    return cur.id;
  }

  feudBetween(p: Person, q: Person): Feud | undefined {
    const a = this.houseOf(p);
    const b = this.houseOf(q);
    if (a === b) return undefined;
    return this.feuds.find((f) => f.ended === undefined && ((f.a === a && f.b === b) || (f.a === b && f.b === a)));
  }

  /** A wrong between two people can set their families against each other. */
  wrong(doer: Person, victim: Person, reason: Feud['reason']): void {
    const life = this.life;
    const a = this.houseOf(doer);
    const b = this.houseOf(victim);
    if (a === b || this.feudBetween(doer, victim)) return;
    const chance = reason === 'murder' ? 1 : reason === 'fight' ? 0.3 : 0.25;
    if (!life.rng.chance(chance)) return;
    const f: Feud = { id: life.raw.nextId++, a, b, since: life.t, reason };
    this.feuds.push(f);
    life.chron('feud', { a, b, s: reason, major: 1 });
    for (const p of [doer, victim]) life.log(p, 'feud', { other: p === doer ? victim.id : doer.id });
  }

  /** In a feud, talks between the families easily turn into quarrels. */
  quarrelBonus(p: Person, q: Person): number {
    return this.feuds.length && this.feudBetween(p, q) ? 0.25 : 0;
  }

  /** Children of feuding families learn to distrust the other family. */
  comeOfAge(child: Person): void {
    const life = this.life;
    const mine = this.houseOf(child);
    for (const f of this.feuds) {
      if (f.ended !== undefined || (f.a !== mine && f.b !== mine)) continue;
      const other = f.a === mine ? f.b : f.a;
      for (const q of life.people) if (q.alive && q !== child && this.houseOf(q) === other) life.addOpinion(child, q.id, -25);
    }
  }

  /** Forgiveness whispered to someone ends their family's feuds. */
  forgive(p: Person): void {
    const mine = this.houseOf(p);
    for (const f of this.feuds) if (f.ended === undefined && (f.a === mine || f.b === mine)) this.endFeud(f, 'forgive', p);
  }

  private endFeud(f: Feud, why: 'wedding' | 'forgive' | 'time', a?: Person, b?: Person): void {
    f.ended = this.life.t;
    void b;
    this.life.chron('feudEnd', { a: f.a, b: f.b, s: why, ...(a ? { c: a.id } : {}), ...(why === 'time' ? {} : { major: 1 as const }) });
  }

  /** Best friend and worst rival of a person (opinions beyond family). */
  bonds(p: Person): { friend: number | null; rival: number | null } {
    let friend: number | null = null;
    let rival: number | null = null;
    let hi = 59;
    let lo = -50;
    for (const [id, v] of p.rels) {
      if (id === p.partner || id === p.mother || id === p.father) continue;
      const q = this.life.person(id);
      if (!q?.alive || q.mother === p.id || q.father === p.id) continue;
      if (v > hi) {
        hi = v;
        friend = id;
      }
      if (v < lo) {
        lo = v;
        rival = id;
      }
    }
    return { friend, rival };
  }
}
