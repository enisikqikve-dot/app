/**
 * The strange future. Factories build robots that work alongside people;
 * beings of artificial intelligence think, invent and may rule; people
 * become part machine (cyborgs) and are cloned; the greatest cities rise
 * into the sky; weather machines tame storms and droughts (even yours); time
 * machines bring travellers from the future to other peoples, and through
 * them the people find out about you. Machines that are not treated as equals
 * may rise up and found a people of their own.
 */
import { Rng } from '../../core/rng';
import { MINUTES_PER_YEAR } from '../clock';
import type { PowerEvent } from '../powers';
import type { World } from '../world';
import { CIV_IDS, CIV_TECHS } from './civtech';
import type { Life } from './life';
import type { Person, Settlement, Tribe } from './types';
import { T_CLEVER, T_CURIOUS } from './types';

const YEAR = MINUTES_PER_YEAR;

const ROBOT_PREFIX = ['R', 'K', 'X', 'T', 'M', 'Z', 'Q', 'B'];
const AI_NAMES = ['Nova', 'Echo', 'Lumen', 'Orion', 'Vega', 'Iris', 'Atlas', 'Sol', 'Lyra', 'Kepler', 'Aura', 'Nexus'];
const MACHINE_PEOPLE = ['Synthi', 'Nexo', 'Kalix', 'Voltan', 'Ferro', 'Kibra'];

/** Disasters the weather machines soften. */
const WEATHER: Set<PowerEvent['kind']> = new Set(['storm', 'drought', 'lightning', 'rain', 'fire']);

export class FutureSystem {
  constructor(private readonly life: Life) {}

  isMachine(p: { kind?: string }): boolean {
    return p.kind === 'robot' || p.kind === 'ai';
  }

  /** Machines of a group (robots and AI beings). */
  private machines(bandId: number): Person[] {
    return this.life.members(bandId).filter((p) => this.isMachine(p));
  }

  private name(kind: 'robot' | 'ai', id: number): string {
    const rng = new Rng(id * 7907);
    if (kind === 'ai') return `${rng.pick(AI_NAMES)}-${rng.int(1, 9)}`;
    return `${rng.pick(ROBOT_PREFIX)}${rng.pick(ROBOT_PREFIX)}-${rng.int(10, 99)}`;
  }

  /** A robot or AI being built for a group. */
  private build(kind: 'robot' | 'ai', s: Settlement, world: World): Person | null {
    const life = this.life;
    const p = life.addAdult(world, s.cell, s.band);
    if (!p) return null;
    p.kind = kind;
    p.name = this.name(kind, p.id);
    p.born = life.t - 20 * YEAR;
    if (kind === 'ai') {
      p.traits[T_CLEVER] = 100;
      p.traits[T_CURIOUS] = 95;
    }
    p.hunger = p.thirst = 0;
    life.log(p, 'built');
    return p;
  }

  /** A copy of a person: same looks, same character, same knowledge, a fresh life. */
  clone(original: Person, world: World): Person | null {
    const life = this.life;
    const p = life.addAdult(world, original.cell, original.band);
    if (!p) return null;
    p.name = `${original.name} II`;
    p.sex = original.sex;
    p.look = { ...original.look, genes: [original.look.genes[0], original.look.genes[1]] };
    p.traits = [...original.traits];
    p.know = original.know;
    p.born = life.t - 18 * YEAR;
    p.cloneOf = original.id;
    if (original.cyborg) p.cyborg = true;
    life.log(p, 'cloned', { other: original.id });
    life.chron('clone', { a: original.id, b: p.id, major: 1 });
    return p;
  }

  /** A disaster near a town with a weather machine is softened (and the people notice). */
  shields(e: PowerEvent, world: World): boolean {
    if (!WEATHER.has(e.kind) || e.cell < 0) return false;
    const life = this.life;
    const town = life.civ.living().find((s) => s.weatherMachine && world.within(s.cell, e.cell, 500));
    if (!town) return false;
    if (e.kind !== 'rain') {
      let last = -Infinity;
      for (let i = life.chronicle.length - 1; i >= 0 && i > life.chronicle.length - 3000; i--) {
        const c = life.chronicle[i];
        if (c.key === 'weatherShield' && c.n === town.id) {
          last = c.t;
          break;
        }
      }
      if (life.t - last > 10 * YEAR) life.chron('weatherShield', { n: town.id, x: town.tribe, s: e.kind, major: 1 });
    }
    return true;
  }

  /** Once a year: factories, clinics, labs and launch pads do their work. */
  yearly(world: World, t: number): void {
    const life = this.life;
    const civ = life.civ;
    for (const s of civ.living()) {
      const tribe = life.tribes.tribe(s.tribe);
      if (!tribe) continue;
      const people = civ.inhabitants(s);
      // Robots: counted ones in the crowd, and a couple you can follow.
      if (civ.knows(tribe, 'robots')) {
        s.robots = Math.round(Math.min(people * 0.5, (s.robots ?? 0) + people * 0.02 + 5));
        const robots = this.machines(s.band).filter((p) => p.kind === 'robot').length;
        if (robots < 2 && life.rng.chance(0.5)) {
          const r = this.build('robot', s, world);
          if (r && (s.robots ?? 0) <= 20) life.chron('machine', { a: r.id, s: 'robot', n: s.id });
        }
      }
      if (civ.knows(tribe, 'ai') && people > 5000 && !this.machines(s.band).some((p) => p.kind === 'ai') && life.rng.chance(0.15)) {
        const a = this.build('ai', s, world);
        if (a) life.chron('machine', { a: a.id, s: 'ai', n: s.id, major: 1 });
      }
      // Cyborgs: people take machine parts (the old and the injured first).
      if (civ.knows(tribe, 'cyborgs')) {
        for (const p of life.members(s.band)) {
          if (this.isMachine(p) || p.cyborg || life.ageOf(p) < 18) continue;
          if (life.rng.chance(p.health < 0.6 || life.ageOf(p) > 55 ? 0.2 : 0.04)) {
            p.cyborg = true;
            life.log(p, 'cyborg');
          }
        }
      }
      // Clones: the powerful have themselves copied.
      if (civ.knows(tribe, 'cloning') && life.rng.chance(0.06)) {
        const leader = life.person(life.band(s.band)?.leader ?? -1);
        const copied = leader && life.people.some((q) => q.alive && q.cloneOf === leader.id);
        if (leader?.alive && !this.isMachine(leader) && leader.cloneOf === undefined && !copied) this.clone(leader, world);
      }
      // The greatest city of a people rises into the sky.
      if (civ.knows(tribe, 'antigravity') && !s.flying && civ.sizeOf(s) >= 2 && !civ.living().some((o) => o.tribe === s.tribe && o.flying && civ.sizeOf(o) >= civ.sizeOf(s)) && life.rng.chance(0.2)) {
        s.flying = true;
        life.chron('flyingCity', { n: s.id, x: s.tribe, major: 1 });
      }
      if (civ.knows(tribe, 'weather') && !s.weatherMachine && civ.sizeOf(s) >= 1 && life.rng.chance(0.25)) s.weatherMachine = true;
      if (civ.knows(tribe, 'timeTravel') && !s.timeMachine && civ.sizeOf(s) >= 2 && life.rng.chance(0.15)) s.timeMachine = true;
    }
    for (const tribe of life.tribes.living()) {
      this.timeTravel(tribe, world, t);
      this.aiRule(tribe);
      this.uprising(tribe, world, t);
    }
  }

  /** Travellers from the future visit other peoples and bring knowledge; and they find you. */
  private timeTravel(tribe: Tribe, world: World, t: number): void {
    const life = this.life;
    const civ = life.civ;
    if (!civ.living().some((s) => s.tribe === tribe.id && s.timeMachine)) return;
    if (!life.raw.godFound) {
      life.raw.godFound = true;
      life.chron('godFound', { x: tribe.id, major: 1 });
      for (const p of life.people) if (p.alive && !this.isMachine(p)) p.faith = Math.min(1, (p.faith ?? 0) + 0.2);
    }
    if (!life.rng.chance(0.1)) return;
    const others = life.tribes.living().filter((o) => o !== tribe && (o.tech ?? 0) !== (tribe.tech ?? 0));
    if (others.length === 0) return;
    const to = others[life.rng.int(0, others.length - 1)];
    const band = life.bands.find((b) => b.tribe === to.id);
    const host = band ? life.person(band.leader) : undefined;
    if (!band || !host?.alive) return;
    const p = life.addAdult(world, host.cell, band.id);
    if (!p) return;
    p.traveler = true;
    p.know = (1 << 11) - 1;
    life.log(p, 'arrived');
    // They teach one thing the hosts are ready for.
    const ready = CIV_IDS.filter((id) => civ.knows(tribe, id) && !civ.knows(to, id) && CIV_TECHS[id].needs.every((n) => civ.knows(to, n)));
    const gift = ready.length ? ready[life.rng.int(0, ready.length - 1)] : undefined;
    life.chron('timeTraveler', { a: p.id, x: to.id, y: tribe.id, ...(gift ? { s: gift } : {}), major: 1 });
    if (gift) civ.learnTech(to, gift, false, tribe);
    void t;
  }

  /** A people may hand power to an artificial intelligence. */
  private aiRule(tribe: Tribe): void {
    const life = this.life;
    if (!life.civ.knows(tribe, 'ai') || life.politics.gov(tribe) === 'ai') return;
    const ai = life.bands.filter((b) => b.tribe === tribe.id).flatMap((b) => this.machines(b.id)).find((p) => p.kind === 'ai');
    if (!ai) return;
    const chance = (tribe.unrest ?? 0) > 0.45 ? 0.08 : tribe.culture[2] > 58 ? 0.03 : 0.01;
    if (life.rng.chance(chance)) life.politics.handTo(tribe, 'ai', ai);
  }

  /** Machines that are not equal before the law may rise up and found a people of their own. */
  private uprising(tribe: Tribe, world: World, t: number): void {
    const life = this.life;
    const civ = life.civ;
    if (!civ.knows(tribe, 'ai') || tribe.origin === 'machines' || life.politics.hasLaw(tribe, 'equality')) return;
    const towns = civ.living().filter((s) => s.tribe === tribe.id && (s.robots ?? 0) > 200);
    if (towns.length < 2 || !life.rng.chance(0.006 + (tribe.unrest ?? 0) * 0.02)) return;
    // The smallest of its robot towns breaks away.
    const town = towns.sort((a, b) => civ.inhabitants(a) - civ.inhabitants(b))[0];
    const band = life.band(town.band);
    if (!band) return;
    const people = life.tribes.found(band, 'machines', tribe.id);
    people.name = new Rng(people.id).pick(MACHINE_PEOPLE);
    people.culture = [70, 5, 40];
    // The machines take over the town; its humans become a counted minority.
    town.crowd = Math.max(0, town.crowd * 0.3) + (town.robots ?? 0);
    life.chron('uprising', { x: people.id, y: tribe.id, n: town.id, major: 1 });
    for (const r of tribe.rel) if (r[0] === people.id) r[1] = -70;
    for (const r of people.rel) if (r[0] === tribe.id) r[1] = -70;
    void world;
    void t;
  }

  /** People with machine parts and machines live longer; machines do not starve or fall ill. */
  agingFactor(p: Person): number {
    if (this.isMachine(p)) return 0;
    return p.cyborg ? 0.35 : 1;
  }

  /** How strongly a people fights with its machines. */
  warBonus(tribe: Tribe | undefined): number {
    const civ = this.life.civ;
    return (civ.knows(tribe, 'robots') ? 0.5 : 0) + (civ.knows(tribe, 'ai') ? 0.4 : 0) + (civ.knows(tribe, 'cyborgs') ? 0.3 : 0);
  }

}
