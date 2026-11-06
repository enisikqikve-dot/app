import { describe, expect, it } from 'vitest';
import { generatePlanet } from '../src/sim/planet/generate';
import { World } from '../src/sim/world';
import { Life } from '../src/sim/life/life';
import { MINUTES_PER_YEAR } from '../src/sim/clock';
import type { PowerEvent, PowerKind } from '../src/sim/powers';

const YEAR = MINUTES_PER_YEAR;
let id = 1;
function cast(life: Life, world: World, kind: PowerKind, extra?: number) {
  const p = life.people.find((x) => x.alive)!;
  const e: PowerEvent = { id: id++, kind, minutes: life.t, cell: p.cell, seed: id };
  if (extra !== undefined) e.extra = extra;
  world.apply(e);
  return life.applyEvent(e, world);
}

describe('faith', () => {
  it('miracles make people believe; a shaman founds a religion with a holy place', () => {
    const world = new World(generatePlanet(1234, 'small'));
    const life = Life.create(world, 360);
    life.advanceTo(2 * YEAR, world);
    cast(life, world, 'sign', 0);
    life.advanceTo(life.t + YEAR, world);
    cast(life, world, 'heal');
    cast(life, world, 'sign', 1);
    life.advanceTo(life.t + 6 * YEAR, world);
    const rel = life.faith.religions[0];
    expect(rel).toBeDefined();
    expect(rel.deity).toBe('sky');
    expect(life.structures.some((s) => s.kind === 'shrine' && s.cell === rel.holy)).toBe(true);
    expect(life.people.some((p) => p.alive && p.shaman)).toBe(true);
    expect(life.faith.followers(rel.id)).toBeGreaterThan(0);
    expect(life.faith.godImage()).toBe('kind');
    expect(life.chronicle.some((c) => c.key === 'religion' && c.s === 'sky')).toBe(true);
  });

  it('stays deterministic across snapshot and resume', () => {
    const a = { world: new World(generatePlanet(1234, 'small')) } as { world: World; life?: Life };
    a.life = Life.create(a.world, 360);
    a.life.advanceTo(YEAR, a.world);
    cast(a.life, a.world, 'sign', 2);
    a.life.advanceTo(3 * YEAR, a.world);
    const snap = a.life.snapshotJson();
    a.life.advanceTo(8 * YEAR, a.world);
    const bWorld = new World(generatePlanet(1234, 'small'));
    const b = Life.restore(snap, { archive: a.life.archive, chronicle: a.life.chronicle });
    b.advanceTo(8 * YEAR, bWorld);
    expect(b.serialize()).toEqual(a.life.serialize());
  });
});
