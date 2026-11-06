/**
 * Peoples and their conflicts. Groups that share an origin form a people
 * (Volk) with a name, a culture and a chief. Groups that live far away or
 * fall out with the chief become a people of their own. Peoples meet, trade
 * goods and ideas, and come to like or hate each other. Hungry people steal,
 * hatred can end in murder, and the guilty are banished. When two peoples
 * hate each other enough, they go to war: battles, the fallen, conquest and
 * refugees, until someone makes peace.
 */
import { Rng } from '../../core/rng';
import { MINUTES_PER_DAY, MINUTES_PER_YEAR } from '../clock';
import type { World } from '../world';
import type { Life } from './life';
import { BIT, INVENTION_IDS } from './inventions';
import type { Band, Person, Tribe, War, WarReason } from './types';
import { T_AGGRESSIVE, T_AMBITIOUS, T_BRAVE, T_CURIOUS, T_KIND, T_PIOUS } from './types';

const DAY = MINUTES_PER_DAY;
const YEAR = MINUTES_PER_YEAR;

const SYL_A = ['Ta', 'Ma', 'Ru', 'Ke', 'O', 'Ni', 'Sa', 'Lu', 'Ba', 'Do', 'Wa', 'Ze', 'I', 'Ko', 'Ha', 'Ye', 'A', 'Tu', 'Mo', 'Ga'];
const SYL_B = ['ma', 'ru', 'ke', 'ni', 'sa', 'lo', 'ba', 'do', 'wa', 'ri', 'to', 'na', 'ka', 'mi', 'ho', 'ye'];
const SYL_C = ['ru', 'n', 'k', 'ni', 'ra', 'sh', 'tu', 'li', 'm', 'go', 'ri', 'tek', 'wa', 'lan'];

/** How far apart (in cells) two groups can be and still meet. */
const MEET_CELLS = 6;
/** How far a group can be from the chief and stay part of the same people. */
const FAR_CELLS = 14;
/** A battle needs the two groups this close (cells). */
const BATTLE_CELLS = 16;
/** At most this many living peoples (and one per 35 people). */
const MAX_TRIBES = 12;

export class TribeSystem {
  constructor(private readonly life: Life) {}

  get tribes(): Tribe[] {
    const d = this.life.raw;
    if (!d.tribes) d.tribes = [];
    return d.tribes;
  }

  get wars(): War[] {
    const d = this.life.raw;
    if (!d.wars) d.wars = [];
    return d.wars;
  }

  tribe(id: number | undefined): Tribe | undefined {
    if (id === undefined) return undefined;
    return this.tribes.find((t) => t.id === id);
  }

  tribeOfBand(bandId: number): Tribe | undefined {
    return this.tribe(this.life.band(bandId)?.tribe);
  }

  living(): Tribe[] {
    return this.tribes.filter((t) => t.ended === undefined);
  }

  relation(a: number, b: number): number {
    if (a === b) return 100;
    return this.tribe(a)?.rel.find((r) => r[0] === b)?.[1] ?? 0;
  }

  hasMet(a: number, b: number): boolean {
    return a === b || !!this.tribe(a)?.rel.some((r) => r[0] === b);
  }

  private addRelation(a: number, b: number, dv: number): void {
    if (a === b) return;
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      const t = this.tribe(x);
      if (!t) continue;
      let r = t.rel.find((e) => e[0] === y);
      if (!r) t.rel.push((r = [y, 0]));
      r[1] = Math.max(-100, Math.min(100, Math.round((r[1] + dv) * 10) / 10));
    }
  }

  war(a: number, b: number): War | undefined {
    return this.wars.find((w) => w.end === undefined && ((w.a === a && w.b === b) || (w.a === b && w.b === a)));
  }

  /** A new people for a group (and every group that follows it later). */
  found(band: Band, origin: Tribe['origin'], parent?: number): Tribe {
    const life = this.life;
    const id = life.raw.nextId++;
    const rng = new Rng((id * 7919) ^ Math.floor(life.t / DAY));
    let name = rng.pick(SYL_A) + rng.pick(SYL_B) + (rng.chance(0.6) ? rng.pick(SYL_C) : '');
    if (name.length > 8) name = name.slice(0, 8);
    name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    // A colour far from the colours of the living peoples.
    const used = this.living().map((t) => t.hue);
    let hue = rng.next();
    let best = -1;
    for (let i = 0; i < 12; i++) {
      const h = (rng.next() + i / 12) % 1;
      const d = used.length ? Math.min(...used.map((u) => Math.min(Math.abs(u - h), 1 - Math.abs(u - h)))) : 1;
      if (d > best) {
        best = d;
        hue = h;
      }
    }
    const tribe: Tribe = { id, name, founded: life.t, hue: Math.round(hue * 1000) / 1000, origin, chief: band.leader, culture: [50, 50, 50], rel: [] };
    if (parent !== undefined) {
      tribe.parent = parent;
      // A people that splits off keeps the crafts and writings of the old one.
      const old = this.tribe(parent);
      if (old?.tech) tribe.tech = old.tech;
      if (old?.lore) tribe.lore = old.lore;
    }
    this.tribes.push(tribe);
    band.tribe = id;
    // Their village goes with them.
    const home = life.civ.homeOf(band.id);
    if (home) home.tribe = id;
    this.updateCulture(tribe);
    if (origin !== 'first') {
      // The old people does not like to see them go (less so when they left peacefully).
      if (parent !== undefined) {
        const old = this.tribe(parent);
        if (old) {
          tribe.rel.push([parent, origin === 'split' ? -30 : 15]);
          old.rel.push([id, origin === 'split' ? -30 : 15]);
        }
      }
      const leader = life.person(band.leader);
      if (leader) life.log(leader, 'newPeople');
      life.chron('tribe', { x: id, ...(parent !== undefined ? { y: parent } : {}), s: origin, ...(leader ? { a: leader.id } : {}), major: 1 });
    }
    return tribe;
  }

  /** Where a group lives: where its leader is. */
  private camp(band: Band): number {
    const leader = this.life.person(band.leader);
    if (leader?.alive) return leader.cell;
    return this.life.members(band.id)[0]?.cell ?? -1;
  }

  // ------------------------------------------------------------ people meet

  /** Two people talk (or quarrel): their peoples get to know and like (or dislike) each other. */
  onTalk(p: Person, q: Person, quarrel: boolean, weight: number): void {
    const a = this.life.band(p.band)?.tribe;
    const b = this.life.band(q.band)?.tribe;
    if (a === undefined || b === undefined || a === b) return;
    this.meet(a, b, p);
    this.addRelation(a, b, quarrel ? -1.5 * weight : 0.4 * weight);
  }

  /** Two peoples meet for the first time. */
  private meet(a: number, b: number, who?: Person): void {
    if (this.hasMet(a, b)) return;
    this.addRelation(a, b, 0);
    this.life.chron('contact', { x: a, y: b, ...(who ? { a: who.id } : {}), major: 1 });
  }

  onCouple(a: Person, b: Person): void {
    const x = this.life.band(a.band)?.tribe;
    const y = this.life.band(b.band)?.tribe;
    if (x !== undefined && y !== undefined && x !== y) this.addRelation(x, y, 8);
  }

  onFight(p: Person, q: Person): void {
    const x = this.life.band(p.band)?.tribe;
    const y = this.life.band(q.band)?.tribe;
    if (x !== undefined && y !== undefined && x !== y) this.addRelation(x, y, -5);
  }

  // ------------------------------------------------------------ crime

  /** A rare murder after a fight full of hatred. Returns true if someone died. */
  maybeMurder(p: Person, q: Person, world: World): boolean {
    const life = this.life;
    if (p.traits[T_AGGRESSIVE] < 72 || life.opinion(p, q.id) > -65) return false;
    const law = life.politics.hasLaw(this.tribeOfBand(p.band), 'murder') ? 0.4 : 1;
    const chance = (0.12 + (p.feel?.kind === 'anger' ? 0.25 : 0) - p.traits[T_KIND] / 400) * law;
    if (!life.rng.chance(chance)) return false;
    life.die(q, 'murder');
    life.log(p, 'murdered', { other: q.id });
    p.crimes = (p.crimes ?? 0) + 3;
    life.chron('murder', { a: p.id, b: q.id, major: 1 });
    // The family and friends of the dead hate the murderer.
    for (const r of life.people) {
      if (!r.alive || r === p) continue;
      if (r.mother === q.id || r.father === q.id || r.id === q.partner || q.mother === r.id || q.father === r.id || life.opinion(r, q.id) >= 40) life.addOpinion(r, p.id, -80);
    }
    const x = life.band(p.band)?.tribe;
    const y = life.band(q.band)?.tribe;
    if (x !== undefined && y !== undefined && x !== y) {
      this.addRelation(x, y, -35);
      const victims = this.tribe(y);
      if (victims) victims.grudge = [x, life.t + 10 * YEAR];
    }
    this.judge(p, world);
    return true;
  }

  /** Once a day for each adult: the hungry and unkind may steal from a neighbouring group. */
  personDaily(p: Person, world: World, age: number): void {
    const life = this.life;
    const poor = life.civ.standing(p) === 'poor';
    if (age < 15 || p.hunger < (poor ? 0.4 : 0.6) || p.traits[T_KIND] > (poor ? 55 : 45) || p.traits[T_AGGRESSIVE] < 48) return;
    const law = life.politics.hasLaw(this.tribeOfBand(p.band), 'theft');
    if (!life.rng.chance(law ? 0.012 : 0.03)) return;
    const own = life.band(p.band);
    let victim: Band | undefined;
    for (const b of life.bands) {
      if (b.id === p.band || b.food < 2) continue;
      const c = this.camp(b);
      if (c >= 0 && world.within(c, p.cell, world.kmPerCell * 4)) {
        victim = b;
        break;
      }
    }
    if (!victim) return;
    victim.food -= 2;
    p.hunger = Math.max(0, p.hunger - 0.45);
    if (own) own.food += 1;
    life.log(p, 'stole');
    const leader = life.person(victim.leader);
    // Caught?
    if (!life.rng.chance(0.55)) return;
    p.crimes = (p.crimes ?? 0) + 1;
    life.log(p, 'caught');
    if (leader?.alive) {
      life.addOpinion(leader, p.id, -30);
      life.addMood(leader, 'robbed', -6, 6);
    }
    life.chron('theft', { a: p.id, ...(leader ? { b: leader.id } : {}) });
    const x = own?.tribe;
    const y = victim.tribe;
    if (x !== undefined && y !== undefined && x !== y) {
      this.meet(x, y, p);
      this.addRelation(x, y, -6);
    }
    this.judge(p, world);
  }

  /** The leader decides about someone who did wrong: forgive or banish. */
  private judge(p: Person, world: World): void {
    const life = this.life;
    if (!p.alive || (p.crimes ?? 0) < 2) return;
    const band = life.band(p.band);
    const leader = band ? life.person(band.leader) : undefined;
    if (!band || !leader?.alive || leader === p) return;
    const mercy = leader.traits[T_KIND] / 200 + life.opinion(leader, p.id) / 300;
    if (life.rng.chance(Math.max(0.05, mercy))) return;
    const murderer = (p.crimes ?? 0) >= 3;
    if (life.exile(p, world)) {
      p.crimes = 0;
      life.log(p, 'banished', { other: leader.id });
      life.chron('banished', { a: p.id, b: leader.id, ...(murderer ? { major: 1 as const } : {}) });
    }
  }

  // ------------------------------------------------------------ every day

  /** Once a day: peoples for new groups, chiefs, trade and battles; once a year: culture, splits, war and peace. */
  daily(world: World, t: number): void {
    const life = this.life;
    for (const band of life.bands) if (band.tribe === undefined) this.adopt(band, world);
    const living = this.living();
    // Chiefs: the leader of each people's largest group.
    for (const tribe of living) {
      if (!life.politics.chiefByGroups(tribe)) continue;
      let chief = -1;
      let size = -1;
      let groups = 0;
      for (const b of life.bands) {
        if (b.tribe !== tribe.id) continue;
        groups++;
        const n = life.members(b.id).length;
        if (n > size) {
          size = n;
          chief = b.leader;
        }
      }
      if (chief !== tribe.chief && chief >= 0) {
        const before = life.person(tribe.chief);
        tribe.chief = chief;
        const p = life.person(chief);
        if (p && groups >= 2) life.log(p, 'chief');
        // The chronicle tells of a new chief of a large people when the old one died.
        if (p && groups >= 3 && !before?.alive) life.chron('chief', { a: chief, x: tribe.id });
      }
    }
    this.trade(world);
    for (const w of this.wars) if (w.end === undefined) this.fight(w, world, t);
    if (Math.floor(t / DAY) % 40 === 7) this.yearly(world, t);
  }

  /** A group without a people joins the people of its nearest neighbour, or becomes a new one. */
  private adopt(band: Band, world: World): void {
    const life = this.life;
    const c = this.camp(band);
    let best: Band | undefined;
    let bestKm = Infinity;
    for (const b of life.bands) {
      if (b === band || b.tribe === undefined || !this.tribe(b.tribe) || this.tribe(b.tribe)!.ended !== undefined) continue;
      const bc = this.camp(b);
      if (c < 0 || bc < 0) continue;
      const km = world.kmBetween(c, bc);
      if (km < bestKm) {
        bestKm = km;
        best = b;
      }
    }
    void bestKm;
    if (best) band.tribe = best.tribe;
    else this.found(band, this.tribes.length === 0 ? 'first' : 'appeared');
  }

  /** Groups that live near each other trade food and ideas. */
  private trade(world: World): void {
    const life = this.life;
    const bands = life.bands;
    const reach = new Map<number, number>();
    for (const tr of this.living()) reach.set(tr.id, life.civ.reach(tr));
    for (let i = 0; i < bands.length; i++) {
      const a = bands[i];
      const ca = this.camp(a);
      if (ca < 0) continue;
      for (let j = i + 1; j < bands.length; j++) {
        const b = bands[j];
        const cb = this.camp(b);
        // Ships and later aircraft bring faraway peoples together.
        const far = MEET_CELLS + Math.max(reach.get(a.tribe ?? -1) ?? 0, reach.get(b.tribe ?? -1) ?? 0);
        if (cb < 0 || !world.within(ca, cb, world.kmPerCell * far)) continue;
        const ta = a.tribe ?? -1;
        const tb = b.tribe ?? -1;
        if (ta !== tb) {
          if (!this.hasMet(ta, tb) && life.rng.chance(0.05)) this.meet(ta, tb, life.person(a.leader));
          // Hungry neighbours quarrel over hunting grounds.
          if (this.hasMet(ta, tb) && Math.max(life.stats(a.id).hunger, life.stats(b.id).hunger) > 0.35) this.addRelation(ta, tb, -0.5);
          if (!this.hasMet(ta, tb) || this.war(ta, tb) || this.relation(ta, tb) < -20) continue;
        }
        const open = ((this.tribe(ta)?.culture[2] ?? 50) + (this.tribe(tb)?.culture[2] ?? 50)) / 200;
        if (!life.rng.chance(0.02 + 0.04 * open)) continue;
        this.barter(a, b);
      }
    }
  }

  private barter(a: Band, b: Band): void {
    const life = this.life;
    const na = Math.max(1, life.members(a.id).length);
    const nb = Math.max(1, life.members(b.id).length);
    // Food goes to where it is short; ideas travel with the goods.
    const diff = a.food / na - b.food / nb;
    const move = Math.round(Math.abs(diff) * Math.min(na, nb) * 0.25 * 10) / 10;
    if (diff > 0) {
      a.food -= move;
      b.food += move;
    } else {
      b.food -= move;
      a.food += move;
    }
    const ka = life.bandKnows(a.id);
    const kb = life.bandKnows(b.id);
    for (const [from, to, known] of [
      [a, b, kb],
      [b, a, ka],
    ] as const) {
      const other = from === a ? ka : kb;
      const ideas = INVENTION_IDS.filter((id) => other & BIT[id] && !(known & BIT[id]));
      if (ideas.length === 0 || !life.rng.chance(0.35)) continue;
      const learner = life.person(to.leader);
      if (learner?.alive) life.learn(learner, ideas[life.rng.int(0, ideas.length - 1)]);
    }
    for (const band of [a, b]) {
      const leader = life.person(band.leader);
      if (!leader?.alive) continue;
      life.log(leader, 'traded', { other: (band === a ? b : a).leader });
      life.addMood(leader, 'trade', 6, 6);
    }
    const ta = a.tribe;
    const tb = b.tribe;
    if (ta === undefined || tb === undefined || ta === tb) return;
    this.addRelation(ta, tb, 2);
    const x = this.tribe(ta);
    const y = this.tribe(tb);
    if (x && y) life.civ.shareByTrade(x, y);
    const t = this.tribe(ta);
    if (t && !(t.traded ?? []).includes(tb)) {
      t.traded = [...(t.traded ?? []), tb];
      const u = this.tribe(tb);
      if (u) u.traded = [...(u.traded ?? []), ta];
      life.chron('trade', { x: ta, y: tb, a: a.leader, b: b.leader, major: 1 });
    }
  }

  // ------------------------------------------------------------ every year

  private updateCulture(tribe: Tribe): void {
    const life = this.life;
    let n = 0;
    let war = 0;
    let pious = 0;
    let open = 0;
    for (const b of life.bands) {
      if (b.tribe !== tribe.id) continue;
      for (const p of life.members(b.id)) {
        if (life.ageOf(p) < 15) continue;
        n++;
        war += p.traits[T_AGGRESSIVE] * 0.6 + p.traits[T_BRAVE] * 0.4 - p.traits[T_KIND] * 0.3 + 15;
        pious += p.traits[T_PIOUS] * 0.4 + (p.faith ?? 0) * 60;
        open += p.traits[T_CURIOUS] * 0.5 + p.traits[T_KIND] * 0.5;
      }
    }
    if (n === 0) return;
    const recentWars = this.wars.filter((w) => (w.a === tribe.id || w.b === tribe.id) && (w.end === undefined || life.t - w.end < 30 * YEAR)).length;
    const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
    tribe.culture = [clamp(war / n + Math.min(12, recentWars * 4)), clamp(pious / n), clamp(open / n - Math.min(10, recentWars * 3))];
  }

  private yearly(world: World, t: number): void {
    const life = this.life;
    for (const tribe of this.living()) {
      // A people without groups is gone.
      if (!life.bands.some((b) => b.tribe === tribe.id)) {
        tribe.ended = t;
        life.chron('tribeGone', { x: tribe.id, major: 1 });
        for (const w of this.wars) if (w.end === undefined && (w.a === tribe.id || w.b === tribe.id)) this.endWar(w, w.a === tribe.id ? w.b : w.a);
        continue;
      }
      this.updateCulture(tribe);
      // Old feelings between peoples fade slowly.
      for (const r of tribe.rel) r[1] = Math.round(r[1] * 0.97 * 10) / 10;
      if (tribe.grudge && tribe.grudge[1] < t) tribe.grudge = undefined;
    }
    // Neighbours rub against each other: warlike peoples provoke, different gods divide.
    const living = this.living();
    const belief = new Map(living.map((tr) => [tr.id, this.mainBelief(tr)]));
    for (let i = 0; i < living.length; i++) {
      for (let j = i + 1; j < living.length; j++) {
        const a = living[i];
        const b = living[j];
        if (!this.hasMet(a.id, b.id)) continue;
        const pair = this.nearestGroups(a.id, b.id, world);
        if (!pair || !world.within(this.camp(pair[0]), this.camp(pair[1]), world.kmPerCell * BATTLE_CELLS)) continue;
        const war = Math.max(a.culture[0], b.culture[0]);
        if (war > 56) this.addRelation(a.id, b.id, -(war - 56) / 6);
        const ba = belief.get(a.id)!;
        const bb = belief.get(b.id)!;
        if (ba >= 0 && bb >= 0 && ba !== bb && a.culture[1] > 45 && b.culture[1] > 45) this.addRelation(a.id, b.id, -5);
      }
    }
    this.splits(world);
    this.declareWars(world, t);
    for (const w of this.wars) if (w.end === undefined) this.maybePeace(w, t);
  }

  /** Far-away groups and groups that fall out with the chief become a people of their own. */
  private splits(world: World): void {
    const life = this.life;
    if (this.living().length >= Math.min(MAX_TRIBES, Math.max(2, Math.floor(life.population() / 35)))) return;
    for (const band of life.bands) {
      const tribe = this.tribe(band.tribe);
      if (!tribe || tribe.chief === band.leader) continue;
      const chief = life.person(tribe.chief);
      const leader = life.person(band.leader);
      if (!chief?.alive || !leader?.alive || chief.band === band.id) continue;
      const strife = life.opinion(leader, chief.id) < -40 && leader.traits[T_AMBITIOUS] > 55;
      const far = !world.within(leader.cell, chief.cell, world.kmPerCell * FAR_CELLS) && life.t - band.founded > 60 * YEAR && life.members(band.id).length >= 6;
      if (strife && life.rng.chance(0.3)) this.found(band, 'split', tribe.id);
      else if (far && life.rng.chance(0.08)) this.found(band, 'far', tribe.id);
      else continue;
      if (this.living().length >= MAX_TRIBES) return;
    }
  }

  /** Peoples who hate each other and live close enough go to war. */
  private declareWars(world: World, t: number): void {
    const life = this.life;
    const living = this.living();
    for (const a of living) {
      for (const r of a.rel) {
        const b = this.tribe(r[0]);
        if (!b || b.ended !== undefined || this.war(a.id, b.id) || r[1] > -35) continue;
        // After a war comes a long truce.
        if (this.wars.some((w) => w.end !== undefined && t - w.end < 30 * YEAR && ((w.a === a.id && w.b === b.id) || (w.a === b.id && w.b === a.id)))) continue;
        const pair = this.nearestGroups(a.id, b.id, world);
        if (!pair || !world.within(this.camp(pair[0]), this.camp(pair[1]), world.kmPerCell * (BATTLE_CELLS + life.civ.reach(a)))) continue;
        const chief = life.person(a.chief);
        const reason = this.reasonFor(a, b, chief);
        const drive = (a.culture[0] / 60) * (reason ? 1 : 0.3) * (r[1] < -60 ? 1.6 : 1) * (chief ? 0.6 + chief.traits[T_AGGRESSIVE] / 125 : 1);
        if (!life.rng.chance(Math.min(0.4, 0.09 * drive))) continue;
        const war: War = { id: life.raw.nextId++, a: a.id, b: b.id, reason: reason ?? 'land', start: t, dead: [0, 0], battles: 0 };
        this.wars.push(war);
        life.chron('war', { x: a.id, y: b.id, s: war.reason, ...(chief ? { a: chief.id } : {}), major: 1 });
        for (const band of life.bands) {
          if (band.tribe !== a.id && band.tribe !== b.id) continue;
          for (const p of life.members(band.id)) life.addMood(p, 'war', -6, 40);
        }
      }
    }
  }

  private reasonFor(a: Tribe, b: Tribe, chief: Person | undefined): WarReason | null {
    const life = this.life;
    if (a.grudge && a.grudge[0] === b.id) return 'revenge';
    if (a.culture[1] > 55 && b.culture[1] > 45) {
      const ba = this.mainBelief(a);
      const bb = this.mainBelief(b);
      if (ba >= 0 && bb >= 0 && ba !== bb) return 'faith';
    }
    let hunger = 0;
    let n = 0;
    for (const band of life.bands) {
      if (band.tribe !== a.id) continue;
      hunger += life.stats(band.id).hunger;
      n++;
    }
    if (n && hunger / n > 0.45) return 'hunger';
    if (chief && chief.traits[T_AMBITIOUS] > 72 && a.culture[0] > 55) return 'ambition';
    if (n >= 4) return 'land';
    return null;
  }

  /** The religion most of a people follows (−1 if none). */
  mainBelief(tribe: Tribe): number {
    const life = this.life;
    const count = new Map<number, number>();
    for (const band of life.bands) {
      if (band.tribe !== tribe.id) continue;
      for (const p of life.members(band.id)) if ((p.belief ?? -1) >= 0) count.set(p.belief!, (count.get(p.belief!) ?? 0) + 1);
    }
    let best = -1;
    let n = 0;
    for (const [id, c] of count) if (c > n) [best, n] = [id, c];
    return best;
  }

  /** The two groups of two peoples that live closest to each other. */
  private nearestGroups(a: number, b: number, world: World): [Band, Band] | null {
    const life = this.life;
    let best: [Band, Band] | null = null;
    let bestKm = Infinity;
    for (const x of life.bands) {
      if (x.tribe !== a) continue;
      const cx = this.camp(x);
      if (cx < 0) continue;
      for (const y of life.bands) {
        if (y.tribe !== b) continue;
        const cy = this.camp(y);
        if (cy < 0) continue;
        const km = world.kmBetween(cx, cy);
        if (km < bestKm) {
          bestKm = km;
          best = [x, y];
        }
      }
    }
    return best;
  }

  /** During a war, the nearest groups of both sides now and then meet in battle. */
  private fight(w: War, world: World, t: number): void {
    const life = this.life;
    if (!life.rng.chance(0.03)) return;
    const pair = this.nearestGroups(w.a, w.b, world);
    if (!pair) return;
    const [ga, gb] = pair;
    const reach = Math.max(life.civ.reach(this.tribe(w.a)), life.civ.reach(this.tribe(w.b)));
    if (!world.within(this.camp(ga), this.camp(gb), world.kmPerCell * (BATTLE_CELLS + reach))) return;
    const fighters = (band: Band) => life.members(band.id).filter((p) => {
      const age = life.ageOf(p);
      return age >= 16 && age <= 55 && !p.pregnant && p.sick <= 0;
    });
    const fa = fighters(ga);
    const fb = fighters(gb);
    if (fa.length === 0 || fb.length === 0) return;
    const civ = life.civ;
    const power = (list: Person[], band: Band, home: boolean) => {
      const know = life.bandKnows(band.id);
      const tr = this.tribe(band.tribe);
      const k = (id: Parameters<typeof civ.knows>[1], f: number) => (civ.knows(tr, id) ? f : 0);
      const arms = 1 + (know & BIT.spear ? 0.3 : 0) + (know & BIT.bow ? 0.4 : 0) + k('bronze', 0.3) + k('iron', 0.4) + k('gunpowder', 0.9) + k('steam', 0.4) + k('flight', 0.7) + k('computer', 0.4);
      return list.reduce((s, p) => s + 0.5 + p.traits[T_BRAVE] / 200 + p.traits[T_AGGRESSIVE] / 250 + (p.feel?.kind === 'courage' ? 0.4 : 0) - (p.feel?.kind === 'fear' ? 0.3 : 0), 0) * arms * (home ? 1.15 : 1);
    };
    const pa = power(fa, ga, false);
    const pb = power(fb, gb, true);
    const aWins = life.rng.chance(pa / (pa + pb));
    const [win, lose, wf, lf] = aWins ? [ga, gb, fa, fb] : [gb, ga, fb, fa];
    const fall = (list: Person[], share: number) => {
      const n = Math.min(list.length, Math.max(list.length > 1 ? 1 : 0, Math.round(list.length * share)));
      const fallen: Person[] = [];
      const pool = [...list];
      for (let i = 0; i < n && pool.length; i++) fallen.push(pool.splice(life.rng.int(0, pool.length - 1), 1)[0]);
      return fallen;
    };
    const winDead = fall(wf, life.rng.range(0.03, 0.12));
    const loseDead = fall(lf, life.rng.range(0.15, 0.35));
    for (const p of [...winDead, ...loseDead]) life.die(p, 'war');
    const winTribe = win.tribe!;
    const aSide = winTribe === w.a;
    // The counted inhabitants of their towns fight and fall too.
    // Later wars are deadlier.
    const deadly = [w.a, w.b].reduce((m, id) => Math.max(m, civ.knows(this.tribe(id), 'flight') ? 2 : civ.knows(this.tribe(id), 'gunpowder') ? 1.5 : 1), 1);
    const crowdLoss = (band: Band, share: number) => {
      const home = life.civ.homeOf(band.id);
      if (!home) return 0;
      const n = Math.floor(home.crowd * Math.min(0.4, share * deadly) * (home.wall ? 0.5 : 1));
      home.crowd -= n;
      return n;
    };
    const winCrowd = crowdLoss(win, life.rng.range(0.01, 0.04));
    const loseCrowd = crowdLoss(lose, life.rng.range(0.05, 0.12));
    w.dead[aSide ? 0 : 1] += winDead.length + winCrowd;
    w.dead[aSide ? 1 : 0] += loseDead.length + loseCrowd;
    w.battles++;
    for (const p of life.members(win.id)) {
      life.addMood(p, 'victory', 8, 15);
      life.log(p, 'battle', { n: 1 });
    }
    for (const p of life.members(lose.id)) {
      life.addMood(p, 'defeat', -10, 20);
      life.log(p, 'battle', { n: 0 });
    }
    const winLeader = life.person(win.leader);
    const loseLeader = life.person(lose.leader);
    life.chron('battle', {
      x: winTribe,
      y: lose.tribe,
      n: winDead.length + loseDead.length + winCrowd + loseCrowd,
      ...(winLeader ? { a: winLeader.id } : {}),
      ...(loseLeader ? { b: loseLeader.id } : {}),
      major: 1,
    });
    this.addRelation(w.a, w.b, -8);
    const loserTribe = this.tribe(lose.tribe);
    if (loserTribe) loserTribe.grudge = [winTribe, t + 15 * YEAR];
    // A beaten small group is conquered, or flees far away.
    const left = life.members(lose.id).length;
    if (left > 0 && (left <= 4 || loseDead.length >= left * 0.5)) {
      const leader = life.person(lose.leader);
      const home = life.civ.homeOf(lose.id);
      if (!home && leader?.alive && leader.traits[T_BRAVE] < 45 && life.emigrate(leader, world, t)) {
        // emigrate() writes the chronicle line (they move away).
      } else {
        lose.tribe = winTribe;
        if (home) home.tribe = winTribe;
        life.chron('conquered', { x: winTribe, y: loserTribe?.id, ...(leader ? { a: leader.id } : {}), ...(home ? { n: home.id } : {}), major: 1 });
      }
    }
  }

  private maybePeace(w: War, t: number): void {
    const life = this.life;
    const years = (t - w.start) / YEAR;
    const a = this.tribe(w.a);
    const b = this.tribe(w.b);
    if (!a || !b) return;
    const chiefs = [life.person(a.chief), life.person(b.chief)].filter((p): p is Person => !!p?.alive);
    const kindness = chiefs.reduce((s, p) => s + p.traits[T_KIND], 0) / Math.max(1, chiefs.length);
    const chance = 0.08 + years * 0.04 + (w.dead[0] + w.dead[1]) * 0.025 + (this.relation(w.a, w.b) > -25 ? 0.3 : 0) + kindness / 400 - a.culture[0] / 400;
    if (life.rng.chance(Math.max(0.03, Math.min(0.9, chance)))) {
      const winner = w.dead[0] * 1.5 < w.dead[1] ? w.a : w.dead[1] * 1.5 < w.dead[0] ? w.b : undefined;
      this.endWar(w, winner);
    }
  }

  private endWar(w: War, winner: number | undefined, by?: Person): void {
    const life = this.life;
    w.end = life.t;
    if (winner !== undefined) w.winner = winner;
    const r = this.relation(w.a, w.b);
    this.addRelation(w.a, w.b, -r - 10);
    life.chron('peace', { x: w.a, y: w.b, n: w.dead[0] + w.dead[1], ...(winner !== undefined ? { s: String(winner) } : {}), ...(by ? { a: by.id } : {}), major: 1 });
  }

  /** You whisper peace to a chief or a leader at war. */
  onPeaceWhisper(p: Person): void {
    const tribe = this.life.band(p.band)?.tribe;
    if (tribe === undefined) return;
    for (const w of this.wars) {
      if (w.end !== undefined || (w.a !== tribe && w.b !== tribe)) continue;
      this.endWar(w, undefined, p);
    }
    for (const t of this.tribes) if (t.grudge && t.grudge[0] === tribe) t.grudge = undefined;
    const own = this.tribe(tribe);
    if (own) own.grudge = undefined;
  }

  /** You whisper anger to a chief: their people turn against their neighbours. */
  onAngerWhisper(p: Person): void {
    const tribe = this.tribe(this.life.band(p.band)?.tribe);
    if (!tribe || tribe.chief !== p.id) return;
    for (const r of tribe.rel) this.addRelation(tribe.id, r[0], -20);
  }
}
