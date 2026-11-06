import { describe, expect, it } from 'vitest';
import { generatePlanet } from '../src/sim/planet/generate';
import { World } from '../src/sim/world';
import { Life } from '../src/sim/life/life';
import { MINUTES_PER_DAY, MINUTES_PER_YEAR } from '../src/sim/clock';
import type { PowerEvent } from '../src/sim/powers';

const YEAR = MINUTES_PER_YEAR;

describe('the future', () => {
  it('cloning makes a likeness with the same looks and character', () => {
    const world = new World(generatePlanet(77, 'small'));
    const life = Life.create(world, 360);
    life.advanceTo(MINUTES_PER_DAY, world);
    const p = life.people.find((x) => x.alive)!;
    const e: PowerEvent = { id: 1, kind: 'clone', minutes: life.t, cell: p.cell, seed: 1, target: p.id };
    world.apply(e);
    life.applyEvent(e, world);
    const c = life.people.find((x) => x.cloneOf === p.id)!;
    expect(c).toBeDefined();
    expect(c.traits).toEqual(p.traits);
    expect(c.look.hair).toBe(p.look.hair);
    expect(c.sex).toBe(p.sex);
    expect(life.chronicle.some((x) => x.key === 'clone')).toBe(true);
  });

  it('machines are built in future towns; they neither starve nor fall ill; time machines find you', () => {
    const world = new World(generatePlanet(77, 'small'));
    const life = Life.create(world, 360);
    for (const p of life.people) p.know = (1 << 11) - 1;
    life.invalidateKnowledge();
    const skip: PowerEvent = { id: 1, kind: 'timeSkip', minutes: life.t, cell: -1, seed: 1, extra: 400 * YEAR };
    world.apply(skip);
    life.applyEvent(skip, world);
    life.advanceTo(life.t + 10 * YEAR, world);
    life.tribes.living()[0].tech = (1 << 20) - 1;
    life.advanceTo(life.t + 120 * YEAR, world);
    for (const tr of life.tribes.living()) tr.tech = (1 << 27) - 1;
    life.advanceTo(life.t + 30 * YEAR, world);
    const robots = life.people.filter((p) => p.alive && p.kind === 'robot');
    expect(robots.length).toBeGreaterThan(0);
    for (const r of robots) {
      expect(r.hunger).toBe(0);
      expect(r.sick).toBe(0);
      expect(r.partner).toBe(-1);
    }
    expect(life.civ.living().some((s) => (s.robots ?? 0) > 0)).toBe(true);
    expect(life.raw.godFound).toBe(true);
    expect(life.chronicle.some((c) => c.key === 'godFound')).toBe(true);
  }, 120000);
});
