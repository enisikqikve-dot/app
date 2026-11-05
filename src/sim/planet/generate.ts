/**
 * Planet generator: continents, mountains, oceans, climate and biomes,
 * all derived from one seed. Pure TypeScript (no rendering), so it can move
 * into a Web Worker and be unit-tested.
 */
import { createNoise3D, type NoiseFunction3D } from 'simplex-noise';
import { Rng } from '../../core/rng';
import { planetName } from '../../core/names';
import type { PlanetSize } from '../../core/worldCode';
import { buildGeodesicGrid, type GeodesicGrid } from './geodesic';
import { Biome, classifyBiome } from './biomes';

export interface PlanetPreset {
  /** Segments per icosahedron edge; cells = 10·f² + 2. */
  frequency: number;
  /** Physical radius shown to the player. Cells stay roughly 45 km apart for every size. */
  radiusKm: number;
}

export const PLANET_PRESETS: Record<PlanetSize, PlanetPreset> = {
  small: { frequency: 40, radiusKm: 1500 },
  medium: { frequency: 64, radiusKm: 2500 },
  large: { frequency: 96, radiusKm: 4000 },
};

export const MAX_HEIGHT_M = 6000;
export const MAX_DEPTH_M = 5000;

export interface PlanetData extends GeodesicGrid {
  seed: number;
  size: PlanetSize;
  name: string;
  radiusKm: number;
  /** −1 (deepest sea) … 0 (sea level) … 1 (highest peak). */
  elevation: Float32Array;
  heightM: Float32Array;
  /** Annual mean temperature, °C. */
  temperature: Float32Array;
  /** Half the summer-to-winter swing, °C (always ≥ 0). */
  seasonAmplitude: Float32Array;
  /** 0 (bone dry) … 1 (very wet). */
  moisture: Float32Array;
  biome: Uint8Array;
  /** Steps to the nearest cell of the other kind (land ↔ water). 0 = coast. */
  coastDistance: Uint16Array;
  oceanFraction: number;
}

export function latitudeOf(y: number): number {
  return Math.asin(Math.max(-1, Math.min(1, y)));
}

/** Longitude convention: a point is (cos φ cos λ, sin φ, −cos φ sin λ). East is +λ. */
export function longitudeOf(x: number, z: number): number {
  return Math.atan2(-z, x);
}

function fbm(noise: NoiseFunction3D, x: number, y: number, z: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Annual mean sea-level temperature by latitude (Earth-like: 28 °C at the equator, −22 °C at the poles). */
export function baseTemperature(latitude: number): number {
  return -22 + 50 * Math.pow(Math.cos(latitude), 1.3);
}

export function generatePlanet(seed: number, size: PlanetSize): PlanetData {
  const preset = PLANET_PRESETS[size];
  const grid = buildGeodesicGrid(preset.frequency);
  const { positions, cellCount, neighborOffsets, neighbors } = grid;
  const rng = new Rng(seed).fork('planet');

  const nWarp = createNoise3D(rng.fork('warp').fn);
  const nCont = createNoise3D(rng.fork('continents').fn);
  const nDetail = createNoise3D(rng.fork('detail').fn);
  const nRidge = createNoise3D(rng.fork('ridges').fn);
  const nRange = createNoise3D(rng.fork('ranges').fn);
  const nClimate = createNoise3D(rng.fork('climate').fn);
  const nMoist = createNoise3D(rng.fork('moisture').fn);

  // Bigger planets get proportionally more (not bigger) continents.
  const scale = preset.radiusKm / 2500;
  const oceanTarget = rng.range(0.58, 0.7);

  // 1. Raw elevation: warped continental noise plus detail.
  const raw = new Float32Array(cellCount);
  for (let i = 0; i < cellCount; i++) {
    const x = positions[i * 3] * scale;
    const y = positions[i * 3 + 1] * scale;
    const z = positions[i * 3 + 2] * scale;
    const wx = fbm(nWarp, x * 1.1 + 5.2, y * 1.1 + 1.3, z * 1.1 + 7.7, 3);
    const wy = fbm(nWarp, x * 1.1 + 9.1, y * 1.1 + 2.8, z * 1.1 + 4.4, 3);
    const wz = fbm(nWarp, x * 1.1 + 3.6, y * 1.1 + 8.2, z * 1.1 + 6.1, 3);
    const continents = fbm(nCont, x * 0.95 + wx * 0.55, y * 0.95 + wy * 0.55, z * 0.95 + wz * 0.55, 4);
    const detail = fbm(nDetail, x * 2.7, y * 2.7, z * 2.7, 4);
    raw[i] = continents + detail * 0.3;
  }

  // 2. Sea level so that the wanted share of the planet is water.
  const sorted = Float32Array.from(raw).sort();
  const seaLevel = sorted[Math.floor(oceanTarget * (cellCount - 1))];
  const minRaw = sorted[0];
  const maxRaw = sorted[cellCount - 1];

  const elevation = new Float32Array(cellCount);
  let maxLand = 0;
  for (let i = 0; i < cellCount; i++) {
    const e = raw[i];
    if (e > seaLevel) {
      let land = (e - seaLevel) / (maxRaw - seaLevel);
      // Mountain ranges: sharp ridges, only inside ridge belts and away from the coast.
      const x = positions[i * 3] * scale;
      const y = positions[i * 3 + 1] * scale;
      const z = positions[i * 3 + 2] * scale;
      const ridge = Math.pow(1 - Math.abs(nRidge(x * 2.1, y * 2.1, z * 2.1)), 3);
      const belt = smoothstep(0.12, 0.5, fbm(nRange, x * 0.8 + 11, y * 0.8 - 4, z * 0.8 + 2, 2));
      land += ridge * belt * 0.8 * smoothstep(0.0, 0.08, land);
      elevation[i] = land;
      if (land > maxLand) maxLand = land;
    } else {
      elevation[i] = -(seaLevel - e) / (seaLevel - minRaw);
    }
  }
  const heightM = new Float32Array(cellCount);
  for (let i = 0; i < cellCount; i++) {
    if (elevation[i] > 0) {
      const land = Math.pow(elevation[i] / maxLand, 1.3);
      elevation[i] = Math.max(land, 1e-4);
      heightM[i] = Math.max(2, land * MAX_HEIGHT_M);
    } else {
      const depth = Math.pow(-elevation[i], 1.2);
      elevation[i] = -Math.max(depth, 1e-4);
      heightM[i] = -Math.max(15, depth * MAX_DEPTH_M);
    }
  }

  // 3. Distance to the coast (multi-source breadth-first search over neighbors).
  const coastDistance = new Uint16Array(cellCount).fill(0xffff);
  const queue = new Uint32Array(cellCount);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < cellCount; i++) {
    const land = heightM[i] >= 0;
    for (let k = neighborOffsets[i]; k < neighborOffsets[i + 1]; k++) {
      if (heightM[neighbors[k]] >= 0 !== land) {
        coastDistance[i] = 0;
        queue[tail++] = i;
        break;
      }
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const land = heightM[i] >= 0;
    for (let k = neighborOffsets[i]; k < neighborOffsets[i + 1]; k++) {
      const n = neighbors[k];
      if (coastDistance[n] === 0xffff && heightM[n] >= 0 === land) {
        coastDistance[n] = coastDistance[i] + 1;
        queue[tail++] = n;
      }
    }
  }
  for (let i = 0; i < cellCount; i++) if (coastDistance[i] === 0xffff) coastDistance[i] = 999;

  // 4. Climate and biomes.
  const temperature = new Float32Array(cellCount);
  const seasonAmplitude = new Float32Array(cellCount);
  const moisture = new Float32Array(cellCount);
  const biome = new Uint8Array(cellCount);
  let waterCells = 0;

  for (let i = 0; i < cellCount; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];
    const lat = latitudeOf(py);
    const land = heightM[i] >= 0;
    const x = px * scale;
    const y = py * scale;
    const z = pz * scale;

    const tNoise = fbm(nClimate, x * 1.6, y * 1.6, z * 1.6, 3) * 3;
    const lapse = land ? (heightM[i] / 1000) * 6.5 : 0;
    temperature[i] = baseTemperature(lat) - lapse + tNoise;

    // Inland regions swing more between summer and winter than coasts.
    const continentality = land ? Math.min(1, coastDistance[i] / 12) : 0;
    seasonAmplitude[i] = Math.abs(Math.sin(lat)) * (land ? 8 + 9 * continentality : 6);

    // Rain belts: wet at the equator and around 60°, dry around 30° and at the poles.
    const latDeg = (Math.abs(lat) * 180) / Math.PI;
    const band = 0.5 + 0.5 * Math.cos((latDeg * 6 * Math.PI) / 180);
    const coast = land ? Math.exp(-coastDistance[i] / 4) : 1;
    const noise = (fbm(nMoist, x * 1.7, y * 1.7, z * 1.7, 4) + 1) / 2;
    moisture[i] = Math.max(0, Math.min(1, 0.4 * band + 0.3 * coast + 0.45 * noise - 0.12));

    biome[i] = classifyBiome({
      heightM: heightM[i],
      temperature: temperature[i],
      moisture: moisture[i],
      nearOcean: land && coastDistance[i] === 0,
    });
    if (!land) waterCells++;
  }

  return {
    ...grid,
    seed,
    size,
    name: planetName(seed),
    radiusKm: preset.radiusKm,
    elevation,
    heightM,
    temperature,
    seasonAmplitude,
    moisture,
    biome,
    coastDistance,
    oceanFraction: waterCells / cellCount,
  };
}

/**
 * Temperature at a cell right now (°C).
 * @param season seasonal signal (−1 … 1, +1 = northern summer)
 * @param localHours local solar time (0 … 24)
 */
export function currentTemperature(planet: PlanetData, cell: number, season: number, localHours: number): number {
  const y = planet.positions[cell * 3 + 1];
  const hemisphere = Math.max(-1, Math.min(1, y * 8));
  const daily = 3.5 * Math.cos(((localHours - 15) / 24) * 2 * Math.PI);
  return planet.temperature[cell] + planet.seasonAmplitude[cell] * hemisphere * season + daily;
}

export const SNOW_TEMPERATURE = 0;

export function isLand(planet: PlanetData, cell: number): boolean {
  return planet.biome[cell] > Biome.ShallowSea;
}
