/**
 * Fresh water: rain falls on every land cell and flows to the lowest
 * neighbor. Where enough water gathers, a river runs; where it cannot flow
 * further (a hollow), a lake forms. Very wet cells have springs.
 */
import type { GeodesicGrid } from './geodesic';

export const FRESH_NONE = 0;
export const FRESH_RIVER = 1;
export const FRESH_LAKE = 2;
export const FRESH_SPRING = 3;

/** Accumulated rain needed for a river (in "wet cells" upstream). */
export const RIVER_FLOW = 5;
const LAKE_FLOW = 4;
const SPRING_MOISTURE = 0.6;

export interface FreshWater {
  /** Downhill neighbor of every land cell, or −1 (hollow / sea). */
  flowTo: Int32Array;
  /** Water passing through each land cell. */
  flow: Float32Array;
  /** FRESH_* per cell. */
  fresh: Uint8Array;
}

export function computeRivers(
  grid: Pick<GeodesicGrid, 'cellCount' | 'neighborOffsets' | 'neighbors'>,
  heightM: Float32Array,
  moisture: Float32Array,
  out?: FreshWater,
): FreshWater {
  const { cellCount, neighborOffsets, neighbors } = grid;
  const flowTo = out?.flowTo ?? new Int32Array(cellCount);
  const flow = out?.flow ?? new Float32Array(cellCount);
  const fresh = out?.fresh ?? new Uint8Array(cellCount);
  flowTo.fill(-1);
  flow.fill(0);
  fresh.fill(FRESH_NONE);

  const land: number[] = [];
  for (let c = 0; c < cellCount; c++) {
    if (heightM[c] < 0) continue;
    land.push(c);
    let lowest = heightM[c];
    for (let k = neighborOffsets[c]; k < neighborOffsets[c + 1]; k++) {
      const n = neighbors[k];
      if (heightM[n] < lowest) {
        lowest = heightM[n];
        flowTo[c] = n;
      }
    }
  }
  // From the highest cell down, pass the water on.
  land.sort((a, b) => heightM[b] - heightM[a] || a - b);
  for (const c of land) {
    flow[c] += 0.25 + moisture[c];
    const d = flowTo[c];
    if (d >= 0 && heightM[d] >= 0) flow[d] += flow[c];
  }
  for (const c of land) {
    if (flowTo[c] < 0) {
      if (flow[c] >= LAKE_FLOW) fresh[c] = FRESH_LAKE;
    } else if (flow[c] >= RIVER_FLOW) {
      fresh[c] = FRESH_RIVER;
    } else if (moisture[c] >= SPRING_MOISTURE) {
      fresh[c] = FRESH_SPRING;
    }
  }
  return { flowTo, flow, fresh };
}
