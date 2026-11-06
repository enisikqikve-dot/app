import { describe, expect, it } from 'vitest';
import { CIV_BIT, CIV_IDS, CIV_TECHS, EPOCHS, epochIndex, epochOf } from '../src/sim/life/civtech';
import { styleFor } from '../src/render/styles';
import { generatePlanet } from '../src/sim/planet/generate';
import { World } from '../src/sim/world';
import { Life } from '../src/sim/life/life';
import { MINUTES_PER_YEAR } from '../src/sim/clock';

const all = (ids: readonly string[]) => ids.reduce((m, id) => m | CIV_BIT[id as keyof typeof CIV_BIT], 0);

describe('ages of the world', () => {
  it('every piece of knowledge needs only earlier knowledge, and fits in the bit mask', () => {
    expect(CIV_IDS.length).toBeLessThanOrEqual(31);
    CIV_IDS.forEach((id, i) => {
      for (const n of CIV_TECHS[id].needs) expect(CIV_IDS.indexOf(n)).toBeLessThan(i);
    });
  });

  it('names the age from what a people knows', () => {
    expect(epochOf(0)).toBe('stone');
    expect(epochOf(CIV_BIT.farming)).toBe('neolithic');
    expect(epochOf(all(['farming', 'masonry', 'wheel', 'writing', 'bronze', 'iron']))).toBe('antiquity');
    expect(epochOf(all(CIV_IDS))).toBe('information');
    expect(epochIndex(all(CIV_IDS))).toBe(EPOCHS.length);
    // Houses: mud, stone, timber, brick, towers.
    expect([0, 2, 3, 4, 5, 6, 7, 8, 9].map(styleFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 4, 4]);
  });

  it('writes the start of a new age into the chronicle once', () => {
    const world = new World(generatePlanet(77, 'small'));
    const life = Life.create(world, 360);
    life.advanceTo(MINUTES_PER_YEAR, world);
    const tribe = life.tribes.living()[0];
    life.civ.learnTech(tribe, 'farming', true);
    life.civ.learnTech(tribe, 'herding', true);
    const epochs = life.chronicle.filter((c) => c.key === 'epoch');
    expect(epochs.map((c) => c.s)).toEqual(['neolithic']);
  });
});
