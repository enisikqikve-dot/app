import { describe, expect, it } from 'vitest';
import { generatePlanet } from '../src/sim/planet/generate';
import { Biome, isWater } from '../src/sim/planet/biomes';
import { Overlay, World } from '../src/sim/world';
import type { PowerEvent, PowerKind } from '../src/sim/powers';
import { MINUTES_PER_DAY, MINUTES_PER_YEAR } from '../src/sim/clock';

const DAY = MINUTES_PER_DAY;
const YEAR = MINUTES_PER_YEAR;

function makeWorld(seed = 4242) {
  return new World(generatePlanet(seed, 'small'));
}

function findCell(world: World, test: (c: number) => boolean): number {
  for (let i = 0; i < world.planet.cellCount; i++) if (test(i)) return i;
  throw new Error('no matching cell');
}

let nextId = 1;
function ev(kind: PowerKind, cell: number, minutes: number, seed = 7): PowerEvent {
  return { id: nextId++, kind, cell, minutes, seed };
}

function fingerprint(world: World, t: number): string {
  const p = world.planet;
  let h = 0;
  for (let i = 0; i < p.cellCount; i++) h = (h * 31 + Math.round(p.heightM[i])) | 0;
  let b = 0;
  for (let i = 0; i < p.cellCount; i++) b = (b * 7 + p.biome[i]) | 0;
  const ov = new Overlay(p.cellCount);
  world.computeOverlay(t, ov);
  let o = 0;
  for (const c of ov.touched) o = (o * 13 + c + Math.round(ov.veg[c] * 100) + Math.round(ov.char[c] * 100)) | 0;
  return `${h}/${b}/${o}/${world.scars.length}/${world.globalTemperature(t).toFixed(3)}`;
}

const forest = (w: World) => (c: number) => {
  const b = w.planet.biome[c];
  return (b === Biome.TemperateForest || b === Biome.Taiga) && w.planet.coastDistance[c] > 3;
};

describe('world events', () => {
  it('replays to exactly the same world (the basis for rewinding)', () => {
    const w = makeWorld();
    const land = findCell(w, forest(w));
    const sea = findCell(w, (c) => w.planet.heightM[c] < -2000);
    const events = [
      ev('fire', land, 100),
      ev('volcano', land, 2 * DAY),
      ev('meteor', sea, 3 * DAY),
      ev('quake', land, 4 * DAY),
      ev('storm', land, 5 * DAY),
      ev('rain', land, 5 * DAY + 100),
      { ...ev('raise', sea, 6 * DAY), stamps: [sea, sea] },
      ev('iceAge', -1, 7 * DAY),
    ];
    for (const e of events) w.apply(e);
    const before = fingerprint(w, 8 * DAY);

    const replay = makeWorld();
    replay.rebuild(events);
    expect(fingerprint(replay, 8 * DAY)).toBe(before);

    // Rewinding to before the meteor drops it and everything after.
    w.rebuild(events.slice(0, 2));
    const partial = makeWorld();
    for (const e of events.slice(0, 2)) partial.apply(e);
    expect(fingerprint(w, 2.5 * DAY)).toBe(fingerprint(partial, 2.5 * DAY));
  });

  it('resets to the untouched planet', () => {
    const w = makeWorld();
    const original = w.planet.heightM.slice();
    const land = findCell(w, forest(w));
    w.apply(ev('volcano', land, 10));
    expect(w.planet.heightM[land]).toBeGreaterThan(original[land] + 1000);
    w.rebuild([]);
    expect(Array.from(w.planet.heightM)).toEqual(Array.from(original));
    expect(w.scars.length).toBe(0);
  });

  it('lets fire spread through a forest over time, and the trees grow back', () => {
    const w = makeWorld();
    const cell = findCell(w, forest(w));
    w.apply(ev('fire', cell, 1000));
    const burn = w.scars.find((s) => s.kind === 'burn')!;
    expect(burn.cells.length).toBeGreaterThan(5);
    expect(w.cellState(cell, 1000 + 60).burning).toBe(true);
    // Later cells catch fire later.
    expect(Math.max(...burn.delay)).toBeGreaterThan(60);
    // Burnt now, regrown after decades.
    expect(w.cellState(cell, 1000 + 2 * DAY).veg).toBeLessThan(0.1);
    expect(w.cellState(cell, 1000 + 60 * YEAR).veg).toBeGreaterThan(0.95);
  });

  it('does not burn the sea or ice', () => {
    const w = makeWorld();
    const sea = findCell(w, (c) => isWater(w.planet.biome[c]));
    w.apply(ev('lightning', sea, 10));
    expect(w.scars.filter((s) => s.kind === 'burn').length).toBe(0);
  });

  it('puts out a fire with rain', () => {
    const w = makeWorld();
    const cell = findCell(w, forest(w));
    w.apply(ev('fire', cell, 0));
    const burn = w.scars.find((s) => s.kind === 'burn')!;
    const lastBefore = Math.max(...burn.delay);
    w.apply(ev('rain', cell, 30));
    // Cells inside the rain that had not caught fire yet never burn.
    const late = burn.cells.findIndex((c, i) => burn.delay[i] > 120 && w.kmBetween(c, cell) < 250);
    if (late >= 0) expect(w.cellState(burn.cells[late], lastBefore + 10).burning).toBe(false);
    expect(w.cellState(cell, 60).burning).toBe(false);
  });

  it('builds a volcano with lava that cools to rock', () => {
    const w = makeWorld();
    const cell = findCell(w, forest(w));
    const before = w.planet.heightM[cell];
    w.apply(ev('volcano', cell, 0));
    expect(w.planet.heightM[cell]).toBeGreaterThan(before + 1500);
    const lava = w.scars.find((s) => s.kind === 'lava')!;
    expect(lava.cells.length).toBeGreaterThan(3);
    expect(w.cellState(cell, 60).lavaHeat).toBeGreaterThan(0.5);
    expect(w.cellState(cell, 30 * DAY).lavaRock).toBe(true);
    // Volcanic winter cools the planet for a while.
    expect(w.globalTemperature(0.5 * YEAR)).toBeLessThan(-2);
    expect(w.globalTemperature(10 * YEAR)).toBeCloseTo(0, 5);
    expect(w.dust(0.5 * YEAR)).toBeGreaterThan(0.2);
  });

  it('can raise a volcanic island from the deep sea', () => {
    const w = makeWorld();
    const sea = findCell(w, (c) => w.planet.heightM[c] < -3000);
    w.apply(ev('volcano', sea, 0));
    expect(w.planet.heightM[sea]).toBeGreaterThan(0);
    expect(isWater(w.planet.biome[sea])).toBe(false);
  });

  it('digs a crater with a meteorite and darkens the sky', () => {
    const w = makeWorld();
    const cell = findCell(w, forest(w));
    const before = w.planet.heightM[cell];
    w.apply(ev('meteor', cell, 0));
    expect(w.planet.heightM[cell]).toBeLessThan(before - 1000);
    expect(w.dust(YEAR)).toBeGreaterThan(0.4);
    expect(w.climateLabel(YEAR)).toBe('impactWinter');
  });

  it('floods low coasts with a tsunami that arrives later further away', () => {
    const w = makeWorld();
    const sea = findCell(w, (c) => w.planet.heightM[c] < -500 && w.planet.coastDistance[c] <= 3);
    w.apply(ev('tsunami', sea, 0));
    const flood = w.scars.find((s) => s.kind === 'flood')!;
    expect(flood.cells.length).toBeGreaterThan(0);
    const i = 0;
    const c = flood.cells[i];
    const arrive = flood.delay[i];
    expect(w.cellState(c, arrive - 1).water).toBe(0);
    expect(w.cellState(c, arrive + 30).water).toBeGreaterThan(0);
  });

  it('runs ice ages for centuries', () => {
    const w = makeWorld();
    w.apply(ev('iceAge', -1, 0));
    expect(w.globalTemperature(100 * YEAR)).toBeCloseTo(-9, 5);
    expect(w.climateLabel(100 * YEAR)).toBe('iceAge');
    expect(w.globalTemperature(600 * YEAR)).toBe(0);
  });

  it('raises and lowers land, and plants forests', () => {
    const w = makeWorld();
    const sea = findCell(w, (c) => w.planet.heightM[c] < -100 && w.planet.heightM[c] > -400);
    w.apply({ ...ev('raise', sea, 0), stamps: [sea, sea] });
    expect(w.planet.heightM[sea]).toBeGreaterThan(0);

    const desert = findCell(w, (c) => w.planet.biome[c] === Biome.Grassland || w.planet.biome[c] === Biome.Steppe);
    w.apply({ ...ev('forest', desert, 10), stamps: [desert] });
    const b = w.planet.biome[desert];
    expect([Biome.Taiga, Biome.TemperateForest, Biome.Rainforest]).toContain(b);
  });

  it('marks changed cells for the renderer', () => {
    const w = makeWorld();
    w.changedCells.clear();
    const cell = findCell(w, forest(w));
    w.apply(ev('quake', cell, 0));
    expect(w.changedCells.size).toBeGreaterThan(0);
  });
});
