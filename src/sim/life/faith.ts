/**
 * Faith. People see your miracles and disasters and come to believe in
 * something higher; what they saw shapes what they believe in. A pious
 * person becomes the group's shaman, the group founds a religion with a
 * holy place, believers pray in hard times, and a prayer you answer
 * strengthens the faith. Belief spreads by talking and from parents.
 */
import type { World } from '../world';
import type { PowerEvent, PowerKind } from '../powers';
import type { Life } from './life';
import type { Band, Deity, Person, PrayerNeed, Religion } from './types';
import { DEITIES, T_PIOUS } from './types';

const DAY = 1440;

/** What a power looks like to the people who see it. */
const SEEN: Partial<Record<PowerKind, { deity: Deity; gain: number; km: number; good: boolean }>> = {
  sign: { deity: 'sky', gain: 0.25, km: 650, good: true },
  lightning: { deity: 'sky', gain: 0.12, km: 250, good: false },
  createPeople: { deity: 'sky', gain: 0.3, km: 250, good: true },
  move: { deity: 'sky', gain: 0.25, km: 200, good: true },
  meteor: { deity: 'wrath', gain: 0.2, km: 900, good: false },
  storm: { deity: 'wrath', gain: 0.08, km: 400, good: false },
  volcano: { deity: 'wrath', gain: 0.2, km: 700, good: false },
  quake: { deity: 'wrath', gain: 0.15, km: 500, good: false },
  tsunami: { deity: 'wrath', gain: 0.15, km: 600, good: false },
  fire: { deity: 'wrath', gain: 0.06, km: 200, good: false },
  plague: { deity: 'wrath', gain: 0.1, km: 450, good: false },
  smite: { deity: 'wrath', gain: 0.2, km: 150, good: false },
  drought: { deity: 'wrath', gain: 0.05, km: 600, good: false },
  heal: { deity: 'healer', gain: 0.3, km: 200, good: true },
  revive: { deity: 'healer', gain: 0.6, km: 300, good: true },
  fertility: { deity: 'healer', gain: 0.15, km: 100, good: true },
  harvest: { deity: 'harvest', gain: 0.15, km: 450, good: true },
  rain: { deity: 'harvest', gain: 0.08, km: 400, good: true },
};

/** Which powers answer which prayer. */
const ANSWERS: Record<PrayerNeed, PowerKind[]> = {
  rain: ['rain', 'harvest'],
  food: ['harvest', 'rain', 'spawnAnimals'],
  health: ['heal', 'revive'],
};

export class FaithSystem {
  constructor(private readonly life: Life) {}

  private faith(p: Person): number {
    return p.faith ?? 0;
  }

  get religions(): Religion[] {
    const d = this.life.raw;
    if (!d.religions) d.religions = [];
    return d.religions;
  }

  religion(id: number): Religion | undefined {
    return this.religions.find((r) => r.id === id);
  }

  /** People who saw a power: faith grows, the group remembers it, prayers may be answered. */
  witness(e: PowerEvent, world: World): void {
    const seen = SEEN[e.kind];
    const d = this.life.raw;
    if (e.kind !== 'timeSkip' && !e.kind.startsWith('w') && e.kind !== 'luck') {
      d.deeds = d.deeds ?? [0, 0];
      if (seen) d.deeds[seen.good ? 0 : 1]++;
    }
    if (!seen || e.cell < 0) return;
    const bands = new Set<number>();
    const variantKm = e.kind === 'sign' && e.extra === 2 ? Infinity : seen.km;
    for (const p of this.life.people) {
      if (!p.alive || !world.within(p.cell, e.cell, variantKm)) continue;
      const gain = seen.gain * (0.5 + p.traits[T_PIOUS] / 100);
      p.faith = Math.min(1, this.faith(p) + gain);
      bands.add(p.band);
    }
    for (const id of bands) {
      const band = this.life.band(id);
      if (!band) continue;
      band.seen = band.seen ?? [0, 0, 0, 0, 0];
      band.seen[DEITIES.indexOf(seen.deity)] += seen.gain;
      if (seen.gain >= (band.holyGain ?? 0)) {
        band.holy = this.life.nearLand(world, e.cell);
        band.holyGain = seen.gain;
      }
      // A prayer answered?
      const prayer = band.prayer;
      if (prayer && this.life.t - prayer.t < 4 * DAY && ANSWERS[prayer.need].includes(e.kind) && world.within(prayer.cell, e.cell, 700)) {
        band.prayer = undefined;
        band.seen[DEITIES.indexOf(seen.deity)] += 0.3;
        for (const q of this.life.members(id)) {
          q.faith = Math.min(1, this.faith(q) + 0.25);
          this.life.addMood(q, 'answered', 15, 20);
        }
        const leader = this.life.person(band.leader);
        this.life.chron('answered', { s: prayer.need, ...(leader ? { a: leader.id } : {}), major: 1 });
        if (leader) this.life.log(leader, 'answered');
      }
    }
  }

  /** Should this believer pray now (in distress, now and then)? */
  wantsToPray(p: Person, world: World): boolean {
    if (this.faith(p) < 0.35 || (p.belief ?? -1) < 0) return false;
    const st = world.cellState(p.cell, this.life.t);
    const need: PrayerNeed | null = st.dry > 0.3 || p.thirst > 0.75 ? 'rain' : p.hunger > 0.7 ? 'food' : p.sick > 0 || this.life.stats(p.band).sick ? 'health' : null;
    if (!need || !this.life.rng.chance(0.15)) return false;
    const band = this.life.band(p.band);
    if (band && (!band.prayer || this.life.t - band.prayer.t > 4 * DAY)) band.prayer = { need, t: this.life.t, cell: p.cell };
    return true;
  }

  /** Once a day per person: faith fades a little without rites, pious people wonder; children follow their parents. */
  personDaily(p: Person, age: number): void {
    let f = this.faith(p);
    const pious = p.traits[T_PIOUS];
    // Without your deeds, faith settles at a calm level; miracles lift it higher, then it fades back.
    if (pious > 65 && f < 0.55) f += 0.0012;
    if (!p.shaman || f > 0.6) f -= 0.0006;
    p.faith = Math.max(0, Math.min(1, f));
    if (age >= 13 && age - 1 / 40 < 13) this.inherit(p);
    if ((p.belief ?? -1) >= 0 && p.faith < 0.12) {
      p.belief = -1;
    }
  }

  private inherit(child: Person): void {
    for (const id of [child.mother, child.father]) {
      const parent = id >= 0 ? this.life.person(id) : undefined;
      if (!parent?.alive || (parent.belief ?? -1) < 0) continue;
      child.belief = parent.belief;
      child.faith = Math.max(this.faith(child), this.faith(parent) * 0.8);
      return;
    }
  }

  /** Believers pass their faith on when they talk. */
  onTalk(p: Person, q: Person, weight: number): void {
    const [a, b] = this.faith(p) >= this.faith(q) ? [p, q] : [q, p];
    if ((a.belief ?? -1) < 0 || a.belief === b.belief) return;
    if (this.faith(b) > this.faith(a) * 0.6 && (b.belief ?? -1) >= 0) return;
    const chance = 0.03 * weight * this.faith(a) * (0.5 + b.traits[T_PIOUS] / 100);
    if (!this.life.rng.chance(Math.min(0.5, chance))) return;
    b.belief = a.belief;
    b.faith = Math.max(this.faith(b), 0.3);
    this.life.log(b, 'converted', { other: a.id });
  }

  /** The group's shaman leads a rite: everyone near feels better and believes more. */
  rite(p: Person): void {
    for (const q of this.life.members(p.band)) {
      if (!q.alive || q.cell !== p.cell) continue;
      if (this.faith(q) < 0.6) q.faith = Math.min(0.6, this.faith(q) + 0.015);
      this.life.addMood(q, 'rite', 6, 4);
    }
  }

  /** Once a day for each group: a shaman is called, a religion founded, faded religions end. */
  bandsDaily(world: World, t: number): void {
    for (const band of this.life.bands) {
      const members = this.life.members(band.id).filter((m) => m.alive);
      if (members.length === 0) continue;
      const mean = members.reduce((s, m) => s + this.faith(m), 0) / members.length;
      let shaman = members.find((m) => m.shaman);
      if (!shaman && mean >= 0.22) {
        let best: Person | null = null;
        let score = -1;
        for (const m of members) {
          const age = this.life.ageOf(m);
          if (age < 20 || this.faith(m) < 0.3) continue;
          const s = this.faith(m) + m.traits[T_PIOUS] / 100;
          if (s > score) {
            score = s;
            best = m;
          }
        }
        if (best) {
          best.shaman = true;
          shaman = best;
          this.life.log(best, 'shaman');
          if (!band.hadShaman) this.life.chron('shaman', { a: best.id });
          band.hadShaman = true;
        }
      }
      const believers = members.filter((m) => (m.belief ?? -1) >= 0).length;
      if (shaman && mean >= 0.4 && believers < members.length / 2 && (shaman.belief ?? -1) < 0) this.found(band, shaman, members, world, t);
    }
    // Once a year: religions nobody follows any more end.
    if (Math.floor(t / DAY) % 40 === 0) {
      const followers = new Map<number, number>();
      for (const p of this.life.people) if (p.alive && (p.belief ?? -1) >= 0) followers.set(p.belief!, (followers.get(p.belief!) ?? 0) + 1);
      for (const r of this.religions) {
        if (r.ended === undefined && !followers.has(r.id)) {
          r.ended = t;
          this.life.chron('religionGone', { n: r.id, major: 1 });
        }
      }
    }
  }

  private found(band: Band, shaman: Person, members: Person[], world: World, t: number): void {
    const seen = band.seen ?? [0, 0, 0, 0, 0];
    let deity: Deity = 'ancestors';
    let best = 0.12;
    seen.forEach((v, i) => {
      if (v > best) {
        best = v;
        deity = DEITIES[i];
      }
    });
    const leader = this.life.person(band.leader);
    const holy = band.holy ?? leader?.cell ?? shaman.cell;
    const rel: Religion = { id: this.life.raw.nextId++, deity, founder: shaman.id, founded: t, holy };
    this.religions.push(rel);
    for (const m of members) {
      if (this.faith(m) >= 0.22 || m === shaman) {
        m.belief = rel.id;
        m.faith = Math.max(this.faith(m), 0.3);
      }
    }
    this.life.addStructure('shrine', holy, band.id, 1);
    this.life.chron('religion', { a: shaman.id, n: rel.id, s: deity, major: 1 });
    void world;
  }

  /** How people see you, from your deeds. */
  godImage(): 'kind' | 'wrathful' | 'fickle' | 'distant' {
    const [good, bad] = this.life.raw.deeds ?? [0, 0];
    if (good + bad < 3) return 'distant';
    if (good >= bad * 2) return 'kind';
    if (bad >= good * 2) return 'wrathful';
    return 'fickle';
  }

  followers(id: number): number {
    let n = 0;
    for (const p of this.life.people) if (p.alive && p.belief === id) n++;
    return n;
  }
}
