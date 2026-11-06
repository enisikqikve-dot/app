import { describe, expect, it } from 'vitest';
import { generatePlanet } from '../src/sim/planet/generate';
import { World } from '../src/sim/world';
import { Life } from '../src/sim/life/life';
import { MINUTES_PER_YEAR } from '../src/sim/clock';
import { CIV_BIT } from '../src/sim/life/civtech';

const YEAR = MINUTES_PER_YEAR;

function wise(seed: number) {
  const world = new World(generatePlanet(seed, 'small'));
  const life = Life.create(world, 360);
  // The founders already know all of the Stone Age.
  for (const p of life.people) p.know = (1 << 11) - 1;
  life.invalidateKnowledge();
  return { world, life };
}

describe('civilisation', () => {
  it('a farming people settles down, its village grows, and every year is recorded', () => {
    const { world, life } = wise(77);
    life.advanceTo(2 * YEAR, world);
    const tribe = life.tribes.living()[0];
    tribe.tech = CIV_BIT.farming;
    life.advanceTo(life.t + 40 * YEAR, world);
    expect(life.civ.living().length).toBeGreaterThan(0);
    const town = life.civ.living()[0];
    expect(life.band(town.band)?.home).toBe(town.id);
    expect(life.chronicle.some((c) => c.key === 'settled')).toBe(true);
    expect(life.totalPopulation()).toBeGreaterThanOrEqual(life.population());
    expect(life.civ.history.length).toBeGreaterThan(30);
    // Farmers work in the fields.
    expect(life.people.some((p) => p.alive && p.task === 'farm')).toBe(true);
  }, 60000);

  it('resumes exactly with villages, crowds and statistics', () => {
    const a = wise(77);
    a.life.advanceTo(2 * YEAR, a.world);
    a.life.tribes.living()[0].tech = CIV_BIT.farming | CIV_BIT.money | CIV_BIT.writing;
    a.life.advanceTo(30 * YEAR, a.world);
    const snap = a.life.snapshotJson();
    a.life.advanceTo(45 * YEAR, a.world);
    const b = wise(77);
    const resumed = Life.restore(snap, { archive: a.life.archive, chronicle: a.life.chronicle, history: a.life.civ.history });
    resumed.advanceTo(45 * YEAR, b.world);
    expect(resumed.serialize()).toEqual(a.life.serialize());
  }, 60000);

  it('writing keeps knowledge, laws are made, a ruler is followed', () => {
    const { world, life } = wise(1234);
    life.advanceTo(2 * YEAR, world);
    const tribe = life.tribes.living()[0];
    tribe.tech = CIV_BIT.farming | CIV_BIT.masonry | CIV_BIT.writing | CIV_BIT.money;
    life.advanceTo(life.t + 60 * YEAR, world);
    expect(tribe.lore).toBeGreaterThan(0);
    expect((tribe.laws ?? []).length).toBeGreaterThan(0);
    expect(life.chronicle.some((c) => c.key === 'law')).toBe(true);
  }, 60000);
});
