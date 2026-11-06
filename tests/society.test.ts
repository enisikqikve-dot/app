import { describe, expect, it } from 'vitest';
import { generatePlanet } from '../src/sim/planet/generate';
import { World } from '../src/sim/world';
import { Life } from '../src/sim/life/life';
import { MINUTES_PER_YEAR } from '../src/sim/clock';
import { CIV_BIT } from '../src/sim/life/civtech';

const YEAR = MINUTES_PER_YEAR;

describe('life together', () => {
  it('grown-ups have dreams, and some come true', () => {
    const world = new World(generatePlanet(77, 'small'));
    const life = Life.create(world, 360);
    life.advanceTo(60 * YEAR, world);
    const adults = life.people.filter((p) => p.alive && life.ageOf(p) >= 16);
    expect(adults.length).toBeGreaterThan(0);
    for (const p of adults) expect(p.dream).toBeDefined();
    const all = [...life.people, ...life.archive];
    expect(all.some((p) => p.dreamDone)).toBe(true);
  }, 60000);

  it('trades follow the work, the age and the place in society', () => {
    const world = new World(generatePlanet(77, 'small'));
    const life = Life.create(world, 360);
    life.advanceTo(2 * YEAR, world);
    const leader = life.person(life.bands[0].leader)!;
    expect(life.society.jobOf(leader)).toBe('chief');
    const child = life.people.find((p) => p.alive && life.ageOf(p) < 14);
    if (child) expect(life.society.jobOf(child)).toBe('child');
    const tribe = life.tribes.living()[0];
    tribe.tech = CIV_BIT.farming | CIV_BIT.writing | CIV_BIT.masonry;
    const someone = life.people.find((p) => p.alive && !life.isLeader(p) && life.ageOf(p) >= 16)!;
    someone.task = 'study';
    expect(life.society.jobOf(someone)).toBe('scholar');
  });

  it('a murder starts a family feud; a wedding between the families ends it', () => {
    const world = new World(generatePlanet(77, 'small'));
    const life = Life.create(world, 360);
    life.advanceTo(YEAR, world);
    const [a, b] = life.people.filter((p) => p.alive);
    life.society.wrong(a, b, 'murder');
    expect(life.society.feudBetween(a, b)).toBeDefined();
    expect(life.society.quarrelBonus(a, b)).toBeGreaterThan(0);
    life.society.onCouple(a, b);
    expect(life.society.feudBetween(a, b)).toBeUndefined();
    expect(life.chronicle.some((c) => c.key === 'feudEnd' && c.s === 'wedding')).toBe(true);
  });
});
