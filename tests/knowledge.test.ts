import { describe, expect, it } from 'vitest';
import { generatePlanet } from '../src/sim/planet/generate';
import { World } from '../src/sim/world';
import { COARSE, Life, TICK } from '../src/sim/life/life';
import { BIT, INVENTION_IDS, nextSteps, maskOf } from '../src/sim/life/inventions';
import { MINUTES_PER_DAY, MINUTES_PER_YEAR } from '../src/sim/clock';
import type { PowerEvent, PowerKind } from '../src/sim/powers';

const DAY = MINUTES_PER_DAY;
const YEAR = MINUTES_PER_YEAR;
const planets = new Map<number, ReturnType<typeof generatePlanet>>();
function setup(seed = 1234) {
  if (!planets.has(seed)) planets.set(seed, generatePlanet(seed, 'small'));
  const world = new World(planets.get(seed)!);
  return { world, life: Life.create(world, 6 * 60) };
}
let id = 1;
function power(life: Life, world: World, kind: PowerKind, extra: Partial<PowerEvent> = {}, seed = 7) {
  const e: PowerEvent = { id: id++, kind, minutes: life.t, cell: extra.cell ?? -1, seed, ...extra };
  world.apply(e);
  return life.applyEvent(e, world);
}

describe('knowledge net', () => {
  it('only offers the next step', () => {
    expect(nextSteps(0)).toEqual(['tools', 'herbs']);
    expect(nextSteps(maskOf(['tools']))).toContain('fire');
    expect(nextSteps(maskOf(['tools']))).not.toContain('bow');
  });

  it('gives a whispered idea, passes knowledge on and loses it with the last who knew', () => {
    let done = false;
    for (let seed = 1; seed <= 15 && !done; seed++) {
      const { world, life } = setup();
      life.advanceTo(DAY, world);
      const p = life.people.find((x) => x.alive)!;
      const out = power(life, world, 'wIdea', { target: p.id, cell: p.cell }, seed);
      if (out.result !== 'accepted') continue;
      done = true;
      expect(p.know).not.toBe(0);
      const invented = INVENTION_IDS.find((k) => p.know & BIT[k])!;
      expect(life.chronicle.some((c) => c.key === 'invention' && c.a === p.id && c.s === invented)).toBe(true);
      // Talking spreads it within months.
      life.advanceTo(life.t + 1 * YEAR, world);
      expect(life.people.filter((q) => q.alive && q.know & BIT[invented]).length).toBeGreaterThan(1);
      // When everyone who knows it dies, it is lost.
      for (const q of life.people) if (q.alive && q.know & BIT[invented]) power(life, world, 'smite', { target: q.id, cell: q.cell });
      expect(life.worldKnows() & BIT[invented]).toBe(0);
      expect(life.chronicle.some((c) => c.key === 'lost' && c.s === invented)).toBe(true);
    }
    expect(done).toBe(true);
  });
});

describe('time skip', () => {
  it('runs in coarse steps, stays deterministic and ends where it should', () => {
    const run = () => {
      const { world, life } = setup(7);
      life.advanceTo(2 * DAY, world);
      power(life, world, 'timeSkip', { extra: 30 * YEAR });
      expect(life.skipping).toBe(true);
      const t0 = life.t;
      const steps = life.advanceTo(t0 + 30 * YEAR, world);
      expect(steps).toBeLessThan((30 * YEAR) / TICK / (COARSE * 0.8));
      expect(life.skipping).toBe(false);
      return { world, life, snap: life.snapshotJson() };
    };
    const a = run();
    const b = run();
    expect(a.life.serialize()).toEqual(b.life.serialize());
    // Resuming from a snapshot taken in the middle of a skip continues the same way.
    const c = setup(7);
    c.life.advanceTo(2 * DAY, c.world);
    power(c.life, c.world, 'timeSkip', { extra: 30 * YEAR });
    c.life.advanceTo(c.life.t + 9 * YEAR, c.world);
    const mid = c.life.snapshotJson();
    c.life.advanceTo(c.life.t + 21 * YEAR, c.world);
    const d = Life.restore(mid, { archive: c.life.archive, chronicle: c.life.chronicle, history: c.life.civ.history });
    d.advanceTo(c.life.t, c.world);
    expect(d.serialize()).toEqual(c.life.serialize());
  });

  it('can be stopped early', () => {
    const { world, life } = setup(7);
    power(life, world, 'timeSkip', { extra: 100 * YEAR });
    life.advanceTo(life.t + 5 * YEAR, world);
    life.endSkip();
    expect(life.skipping).toBe(false);
    const before = life.t;
    expect(life.advanceTo(before + DAY, world)).toBe(DAY / TICK);
  });
});

describe('a long stone age', () => {
  const long = setup(1234);
  power(long.life, long.world, 'timeSkip', { extra: 300 * YEAR });
  long.life.advanceTo(long.life.t + 300 * YEAR, long.world);

  it('people survive, invent, build camps and hunt', () => {
    const { life } = long;
    expect(life.population()).toBeGreaterThan(10);
    expect(life.chronicle.filter((c) => c.key === 'invention').length).toBeGreaterThanOrEqual(2);
    const know = life.worldKnows();
    if (know & BIT.fire) expect(life.structures.some((s) => s.kind === 'fire')).toBe(true);
  });

  it('animals evolve: herds drift with the climate and new species appear', () => {
    const { life } = long;
    expect(life.species.length).toBeGreaterThan(4);
    expect(life.chronicle.some((c) => c.key === 'species')).toBe(true);
    const changed = life.herds.filter((h) => Math.abs(h.genes[1] - 0.5) > 0.15).length;
    expect(changed).toBeGreaterThan(life.herds.length * 0.3);
  });

  it('a released new species gets its own name', () => {
    const { world, life } = setup(5);
    const land = life.people[0].cell;
    power(life, world, 'spawnAnimals', { cell: land, extra: 4 });
    const rec = life.species[life.species.length - 1];
    expect(rec.prefix).not.toBe('');
    expect(life.herds.some((h) => h.kind === rec.id)).toBe(true);
  });
});
