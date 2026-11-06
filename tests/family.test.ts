import { describe, expect, it } from 'vitest';
import { generatePlanet } from '../src/sim/planet/generate';
import { World } from '../src/sim/world';
import { Life } from '../src/sim/life/life';
import { expressHair } from '../src/sim/life/genetics';
import { MINUTES_PER_DAY, MINUTES_PER_YEAR } from '../src/sim/clock';
import type { PowerEvent, PowerKind } from '../src/sim/powers';
import type { LifeData, Person } from '../src/sim/life/types';

const DAY = MINUTES_PER_DAY;
const YEAR = MINUTES_PER_YEAR;

const worlds = new Map<number, ReturnType<typeof generatePlanet>>();
function setup(seed = 7) {
  if (!worlds.has(seed)) worlds.set(seed, generatePlanet(seed, 'small'));
  const world = new World(worlds.get(seed)!);
  const life = Life.create(world, 6 * 60);
  return { world, life };
}

let eventId = 1;
function cast(life: Life, world: World, kind: PowerKind, target: Person, seed: number, other?: Person) {
  const e: PowerEvent = { id: eventId++, kind, minutes: life.t, cell: target.cell, seed, target: target.id };
  if (other) e.other = other.id;
  world.apply(e);
  return life.applyEvent(e, world);
}

describe('life and love', () => {
  const grown = setup(7);
  grown.life.advanceTo(45 * YEAR, grown.world);

  it('forms couples, has children who know their parents, and keeps a chronicle', () => {
    const { life } = grown;
    const keys = new Set(life.chronicle.map((c) => c.key));
    expect(keys.has('founders')).toBe(true);
    expect(keys.has('couple')).toBe(true);
    expect(keys.has('birth')).toBe(true);
    const born = [...life.people, ...life.archive].filter((p) => p.mother >= 0);
    expect(born.length).toBeGreaterThan(5);
    for (const child of born) {
      const mother = life.anyone(child.mother)!;
      expect(mother.sex).toBe('f');
      expect(life.childrenOf(mother.id).some((c) => c.id === child.id)).toBe(true);
      // One hair allele from each parent; the dominant one shows.
      expect(mother.look.genes).toContain(child.look.genes[0]);
      if (child.father >= 0) expect(life.anyone(child.father)!.look.genes).toContain(child.look.genes[1]);
      expect(child.look.hair).toBe(expressHair(child.look.genes));
    }
  });

  it('never pairs close relatives', () => {
    const { life } = grown;
    for (const c of life.chronicle) {
      if (c.key !== 'couple') continue;
      const a = life.anyone(c.a!)!;
      const b = life.anyone(c.b!)!;
      expect(life.isCloseKin(a, b)).toBe(false);
      expect(a.sex).not.toBe(b.sex);
    }
  });

  it('archives the dead and still finds them', () => {
    const { life } = grown;
    expect(life.archive.length).toBeGreaterThan(0);
    for (const a of life.archive) {
      expect(life.anyone(a.id)).toBe(a);
      expect(life.person(a.id)).toBeUndefined();
      expect(life.chronicle.some((c) => c.key === 'death' && c.a === a.id)).toBe(true);
    }
    // Only recently dead people stay in the list of the living.
    for (const p of life.people) if (!p.alive) expect(life.t - p.died!).toBeLessThanOrEqual(6 * DAY);
  });

  it('resumes exactly from a compact snapshot plus the shared archive and chronicle', () => {
    const a = setup(1234);
    a.life.advanceTo(12 * YEAR, a.world);
    const snap = a.life.snapshotJson();
    a.life.advanceTo(24 * YEAR, a.world);

    const b = setup(1234);
    const resumed = Life.restore(snap, { archive: a.life.archive, chronicle: a.life.chronicle });
    resumed.advanceTo(24 * YEAR, b.world);
    expect(resumed.serialize()).toEqual(a.life.serialize());
  });

  it('lets whispers change minds, but not always', () => {
    const results = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const { world, life } = setup(21);
      life.advanceTo(2 * DAY, world);
      const follower = life.people.find((p) => p.alive && !life.isLeader(p))!;
      const out = cast(life, world, 'wLead', follower, seed);
      results.add(out.result!);
      if (out.result === 'accepted') {
        expect(life.isLeader(follower)).toBe(true);
        expect(life.chronicle.some((c) => c.key === 'leader' && c.a === follower.id)).toBe(true);
      } else expect(follower.log.some((l) => l.key === 'resisted')).toBe(true);
    }
    expect(results.has('accepted')).toBe(true);
  });

  it('can make two people fall in love and a group move away', () => {
    let loved = false;
    let moved = false;
    for (let seed = 1; seed <= 10 && !(loved && moved); seed++) {
      const { world, life } = setup(21);
      life.advanceTo(DAY, world);
      const single = (sex: 'f' | 'm') => life.people.find((p) => p.alive && p.sex === sex && p.partner < 0);
      const f = single('f');
      const m = single('m');
      if (f && m && cast(life, world, 'wLove', f, seed, m).result === 'accepted') {
        expect(life.opinion(f, m.id)).toBeGreaterThanOrEqual(80);
        if (f.partner === m.id) loved = true;
      }
      const leaderBand = life.people[0].band;
      const mover = life.people.find((p) => p.alive && !life.isLeader(p) && p.band === leaderBand)!;
      const out = cast(life, world, 'wEmigrate', mover, seed);
      if (out.result === 'accepted') {
        expect(mover.band).not.toBe(leaderBand);
        expect(life.isLeader(mover)).toBe(true);
        expect(mover.dest).toBeDefined();
        moved = true;
      }
    }
    expect(loved).toBe(true);
    expect(moved).toBe(true);
  });

  it('blesses a couple with a child', () => {
    const { world, life } = grown;
    const mother = life.people.find((p) => p.alive && p.sex === 'f' && p.partner >= 0 && !p.pregnant && life.ageOf(p) < 50);
    if (!mother) return;
    const before = life.childrenOf(mother.id).length;
    expect(life.check('fertility', mother)).toBeNull();
    cast(life, world, 'fertility', mother, 5);
    expect(mother.pregnant).toBeDefined();
    life.advanceTo(life.t + 31 * DAY, world);
    expect(life.childrenOf(mother.id).length).toBeGreaterThan(before);
  });

  it('upgrades a living world from milestone 3', () => {
    const { world, life } = setup(7);
    life.advanceTo(3 * DAY, world);
    const old = life.serialize() as Partial<LifeData> & Record<string, unknown>;
    delete old.version;
    delete old.bands;
    delete old.archive;
    delete old.chronicle;
    for (const p of old.people as unknown as Record<string, unknown>[]) {
      for (const k of ['traits', 'mother', 'father', 'partner', 'partners', 'band', 'rels', 'moods', 'social']) delete p[k];
      delete (p.look as Record<string, unknown>).genes;
    }
    const up = Life.restore(old as LifeData);
    up.advanceTo(10 * DAY, world);
    expect(up.population()).toBeGreaterThan(0);
    expect(up.bands.length).toBeGreaterThan(0);
    for (const p of up.people) {
      expect(p.traits).toHaveLength(8);
      if (p.alive) expect(up.band(p.band)).toBeDefined();
    }
  });
});
