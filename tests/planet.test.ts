import { describe, expect, it } from 'vitest';
import { buildGeodesicGrid, nearestCell } from '../src/sim/planet/geodesic';
import { generatePlanet, latitudeOf } from '../src/sim/planet/generate';
import { Biome, BIOME_KEYS, isWater } from '../src/sim/planet/biomes';

describe('geodesic grid', () => {
  it('has 10·f²+2 cells and 20·f² faces', () => {
    for (const f of [1, 2, 5, 16]) {
      const g = buildGeodesicGrid(f);
      expect(g.cellCount).toBe(10 * f * f + 2);
      expect(g.faces.length / 3).toBe(20 * f * f);
    }
  });

  it('gives every cell 5 or 6 neighbors, symmetrically', () => {
    const g = buildGeodesicGrid(8);
    let fives = 0;
    for (let i = 0; i < g.cellCount; i++) {
      const count = g.neighborOffsets[i + 1] - g.neighborOffsets[i];
      expect(count === 5 || count === 6).toBe(true);
      if (count === 5) fives++;
      for (let k = g.neighborOffsets[i]; k < g.neighborOffsets[i + 1]; k++) {
        const n = g.neighbors[k];
        const back = Array.from(g.neighbors.subarray(g.neighborOffsets[n], g.neighborOffsets[n + 1]));
        expect(back).toContain(i);
      }
    }
    expect(fives).toBe(12); // the original icosahedron corners
  });

  it('finds the nearest cell by walking', () => {
    const g = buildGeodesicGrid(12);
    for (let i = 0; i < g.cellCount; i += 37) {
      const x = g.positions[i * 3];
      const y = g.positions[i * 3 + 1];
      const z = g.positions[i * 3 + 2];
      expect(nearestCell(g, x, y, z, 0)).toBe(i);
    }
  });
});

function checksum(data: ArrayLike<number>): number {
  let h = 0;
  for (let i = 0; i < data.length; i++) h = (h * 31 + Math.round(data[i] * 1000)) | 0;
  return h;
}

describe('planet generator', () => {
  it('is deterministic', () => {
    const a = generatePlanet(1234, 'small');
    const b = generatePlanet(1234, 'small');
    expect(checksum(a.heightM)).toBe(checksum(b.heightM));
    expect(checksum(a.biome)).toBe(checksum(b.biome));
    expect(a.name).toBe(b.name);
  });

  it('differs between seeds', () => {
    expect(checksum(generatePlanet(1, 'small').heightM)).not.toBe(checksum(generatePlanet(2, 'small').heightM));
  });

  it('is mostly water with real continents, on every size', () => {
    for (const size of ['small', 'medium', 'large'] as const) {
      const p = generatePlanet(77, size);
      expect(p.oceanFraction).toBeGreaterThan(0.55);
      expect(p.oceanFraction).toBeLessThan(0.75);
    }
  });

  it('is warm at the equator and cold at the poles', () => {
    const p = generatePlanet(5, 'medium');
    let polar = 0;
    let polarCount = 0;
    let tropical = 0;
    let tropicalCount = 0;
    for (let i = 0; i < p.cellCount; i++) {
      const lat = Math.abs(latitudeOf(p.positions[i * 3 + 1]));
      if (lat > 1.3) {
        polar += p.temperature[i];
        polarCount++;
      } else if (lat < 0.2 && p.heightM[i] < 500) {
        tropical += p.temperature[i];
        tropicalCount++;
      }
    }
    expect(polar / polarCount).toBeLessThan(-10);
    expect(tropical / tropicalCount).toBeGreaterThan(20);
  });

  it('has a rich mix of biomes', () => {
    for (const seed of [11, 22, 33, 44, 55]) {
      const p = generatePlanet(seed, 'medium');
      const counts = new Array(BIOME_KEYS.length).fill(0);
      for (let i = 0; i < p.cellCount; i++) counts[p.biome[i]]++;
      const landCells = counts.reduce((sum, c, b) => (isWater(b) ? sum : sum + c), 0);
      const presentLand = counts.filter((c, b) => !isWater(b) && c > landCells * 0.01).length;
      expect(presentLand, `seed ${seed}: ${JSON.stringify(counts)}`).toBeGreaterThanOrEqual(8);
      expect(counts[Biome.Mountains] + counts[Biome.Ice]).toBeGreaterThan(0);
      // Forests and open land both exist, deserts do not dominate.
      expect(counts[Biome.TemperateForest] + counts[Biome.Rainforest] + counts[Biome.Taiga]).toBeGreaterThan(landCells * 0.1);
      expect(counts[Biome.Desert]).toBeLessThan(landCells * 0.3);
    }
  });

  it('marks coasts with distance 0', () => {
    const p = generatePlanet(9, 'small');
    for (let i = 0; i < p.cellCount; i++) {
      if (p.coastDistance[i] !== 0) continue;
      const land = p.heightM[i] >= 0;
      let touchesOther = false;
      for (let k = p.neighborOffsets[i]; k < p.neighborOffsets[i + 1]; k++) {
        if (p.heightM[p.neighbors[k]] >= 0 !== land) touchesOther = true;
      }
      expect(touchesOther).toBe(true);
    }
  });
});
