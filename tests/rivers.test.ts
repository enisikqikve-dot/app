import { describe, expect, it } from 'vitest';
import { generatePlanet } from '../src/sim/planet/generate';
import { FRESH_LAKE, FRESH_RIVER, FRESH_SPRING } from '../src/sim/planet/rivers';

describe('rivers and lakes', () => {
  it('has rivers, lakes and springs on land only', () => {
    for (const seed of [3, 30, 300]) {
      const p = generatePlanet(seed, 'medium');
      let land = 0;
      const n = [0, 0, 0, 0];
      for (let c = 0; c < p.cellCount; c++) {
        if (p.heightM[c] < 0) {
          expect(p.fresh[c]).toBe(0);
          continue;
        }
        land++;
        n[p.fresh[c]]++;
      }
      const share = (k: number) => n[k] / land;
      expect(share(FRESH_RIVER), `seed ${seed} rivers`).toBeGreaterThan(0.02);
      expect(share(FRESH_RIVER)).toBeLessThan(0.2);
      expect(n[FRESH_LAKE]).toBeGreaterThan(0);
      expect(share(FRESH_RIVER) + share(FRESH_LAKE) + share(FRESH_SPRING)).toBeGreaterThan(0.12);
    }
  });

  it('flows downhill', () => {
    const p = generatePlanet(7, 'small');
    for (let c = 0; c < p.cellCount; c++) {
      const d = p.flowTo[c];
      if (d >= 0) expect(p.heightM[d]).toBeLessThan(p.heightM[c]);
    }
  });
});
