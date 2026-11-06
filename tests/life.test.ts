import { describe, expect, it } from 'vitest';
import { generatePlanet } from '../src/sim/planet/generate';
import { World } from '../src/sim/world';
import { Life, TICK } from '../src/sim/life/life';
import { MINUTES_PER_DAY } from '../src/sim/clock';
import type { PowerEvent } from '../src/sim/powers';

const DAY = MINUTES_PER_DAY;

function setup(seed = 21) {
  const world = new World(generatePlanet(seed, 'small'));
  const life = Life.create(world, 6 * 60);
  return { world, life };
}

describe('life', () => {
  it('starts with six people near water and herds on the land', () => {
    const { world, life } = setup();
    expect(life.population()).toBe(6);
    const home = life.people[0].cell;
    expect(world.planet.heightM[home]).toBeGreaterThanOrEqual(0);
    expect(life.herds.length).toBeGreaterThan(10);
    expect(life.herds.some((h) => h.species === 'wolf')).toBe(true);
  });

  it('keeps people alive for weeks when nothing bad happens', () => {
    const { world, life } = setup();
    life.advanceTo(30 * DAY, world);
    expect(life.population()).toBe(6);
    for (const p of life.people) {
      expect(p.thirst).toBeLessThan(1);
      expect(p.hunger).toBeLessThan(1);
    }
    // They actually do things.
    const actions = new Set(life.people.map((p) => p.action));
    expect(actions.size).toBeGreaterThan(0);
  });

  it('is deterministic and can resume from a snapshot', () => {
    const a = setup();
    const b = setup();
    a.life.advanceTo(5 * DAY, a.world);
    const snap = a.life.serialize();
    a.life.advanceTo(12 * DAY, a.world);
    b.life.advanceTo(12 * DAY, b.world);
    expect(JSON.stringify(a.life.serialize())).toBe(JSON.stringify(b.life.serialize()));

    const c = setup();
    const resumed = Life.restore(snap);
    resumed.advanceTo(12 * DAY, c.world);
    expect(JSON.stringify(resumed.serialize())).toBe(JSON.stringify(a.life.serialize()));
  });

  it('kills people caught by lava and lets the gods create, heal, carry and revive', () => {
    const { world, life } = setup();
    life.advanceTo(DAY, world);
    const victim = life.people[0];
    let id = 1;
    const apply = (e: Omit<PowerEvent, 'id' | 'minutes' | 'seed'>) => {
      const event: PowerEvent = { id: id++, minutes: life.t, seed: 99, ...e };
      world.apply(event);
      life.applyEvent(event, world);
    };
    apply({ kind: 'volcano', cell: victim.cell });
    life.advanceTo(life.t + 3 * TICK, world);
    expect(victim.alive).toBe(false);
    expect(['lava', 'impact']).toContain(victim.cause);

    apply({ kind: 'revive', cell: victim.cell, target: victim.id });
    expect(victim.alive).toBe(true);

    const before = life.population();
    apply({ kind: 'createPeople', cell: victim.cell, extra: 5 });
    expect(life.population()).toBe(before + 5);

    const p = life.people[life.people.length - 1];
    expect(p.alive).toBe(true);
    apply({ kind: 'smite', cell: p.cell, target: p.id });
    expect(p.alive).toBe(false);
    expect(p.cause).toBe('god');

    const q = life.people[life.people.length - 2];
    const far = q.cell === 0 ? 1 : 0;
    apply({ kind: 'move', cell: far, target: q.id });
    expect(q.action).toBe('carried');
  });

  it('makes people sick in a plague and heals them with a blessing', () => {
    const { world, life } = setup();
    const cell = life.people[0].cell;
    const plague: PowerEvent = { id: 1, kind: 'plague', minutes: life.t, cell, seed: 5 };
    world.apply(plague);
    life.applyEvent(plague, world);
    life.advanceTo(life.t + 2 * DAY, world);
    expect(life.people.some((p) => p.sick > 0 || p.immune)).toBe(true);
    const heal: PowerEvent = { id: 2, kind: 'heal', minutes: life.t, cell, seed: 6 };
    world.apply(heal);
    life.applyEvent(heal, world);
    for (const p of life.people) if (p.alive && world.kmBetween(p.cell, cell) < 170) expect(p.sick).toBe(0);
  });

  it('lets herds graze, move and be hunted', () => {
    const { world, life } = setup();
    const start = life.herds.map((h) => `${h.id}:${h.cell}`).join();
    const total = () => life.herds.reduce((n, h) => n + h.count, 0);
    const before = total();
    life.advanceTo(20 * DAY, world);
    expect(life.herds.map((h) => `${h.id}:${h.cell}`).join()).not.toBe(start);
    expect(total()).toBeGreaterThan(before * 0.3);
  });

  it('gives a blessed harvest more food', () => {
    const { world, life } = setup();
    const cell = life.people[0].cell;
    const before = life.foodAt(world, cell, life.t);
    const e: PowerEvent = { id: 1, kind: 'harvest', minutes: life.t, cell, seed: 1 };
    world.apply(e);
    life.applyEvent(e, world);
    expect(life.foodAt(world, cell, life.t + DAY)).toBeGreaterThan(before);
  });
});
