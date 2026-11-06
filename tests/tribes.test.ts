import { describe, expect, it } from 'vitest';
import { generatePlanet } from '../src/sim/planet/generate';
import { World } from '../src/sim/world';
import { Life } from '../src/sim/life/life';
import { MINUTES_PER_YEAR } from '../src/sim/clock';
import type { PowerEvent } from '../src/sim/powers';

const YEAR = MINUTES_PER_YEAR;

function farCell(world: World, from: number): number {
  let far = from;
  let best = -1;
  for (let c = 0; c < world.planet.cellCount; c += 3) {
    if (world.planet.heightM[c] < 0) continue;
    const d = world.kmBetween(c, from);
    if (d > best && d < 1800) {
      best = d;
      far = c;
    }
  }
  return far;
}

describe('peoples and conflicts', () => {
  it('the first people forms, newcomers far away become a second people', () => {
    const world = new World(generatePlanet(1234, 'small'));
    const life = Life.create(world, 360);
    life.advanceTo(2 * YEAR, world);
    expect(life.tribes.living()).toHaveLength(1);
    const first = life.tribes.living()[0];
    expect(life.bands.every((b) => b.tribe === first.id)).toBe(true);
    const e: PowerEvent = { id: 1, kind: 'createPeople', minutes: life.t, cell: farCell(world, life.people[0].cell), seed: 3, extra: 5 };
    world.apply(e);
    life.applyEvent(e, world);
    expect(life.tribes.living()).toHaveLength(2);
    expect(life.chronicle.some((c) => c.key === 'tribe' && c.s === 'appeared')).toBe(true);
    const second = life.tribes.living()[1];
    expect(second.name).not.toBe(first.name);
    life.advanceTo(life.t + 2 * YEAR, world);
    // Every group belongs to a people.
    expect(life.bands.every((b) => b.tribe !== undefined)).toBe(true);
  });

  it('wars are fought between hostile neighbours and end in peace; a whisper of peace ends a war', () => {
    const world = new World(generatePlanet(1234, 'small'));
    const life = Life.create(world, 360);
    life.advanceTo(YEAR, world);
    const home = life.people[0].cell;
    // A second people close by, and bad blood between them.
    const near = world.planet.neighbors[world.planet.neighborOffsets[home]];
    const e: PowerEvent = { id: 1, kind: 'createPeople', minutes: life.t, cell: farCell(world, home), seed: 3, extra: 6 };
    world.apply(e);
    life.applyEvent(e, world);
    const [a, b] = life.tribes.living();
    // Move the newcomers next door.
    for (const p of life.people) if (life.band(p.band)?.tribe === b.id) p.cell = near;
    a.rel.push([b.id, -80]);
    b.rel.push([a.id, -80]);
    a.culture[0] = 90;
    let war = false;
    for (let y = 0; y < 30 && !war; y++) {
      life.advanceTo(life.t + YEAR, world);
      war = life.tribes.wars.length > 0;
      for (const p of life.people) if (p.alive && life.band(p.band)?.tribe === b.id) p.cell = near;
    }
    expect(war).toBe(true);
    const w = life.tribes.wars[0];
    if (w.end === undefined) {
      const chief = life.person(life.tribes.tribe(w.a)!.chief)!;
      life.tribes.onPeaceWhisper(chief);
      expect(w.end).toBeDefined();
    }
    expect(life.chronicle.some((c) => c.key === 'war')).toBe(true);
    expect(life.chronicle.some((c) => c.key === 'peace')).toBe(true);
  });
});
